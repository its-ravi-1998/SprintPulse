from rest_framework import viewsets, permissions, status, views
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from django.conf import settings

from django.contrib.auth.models import User
from .models import Sprint, Task, TaskComment, Team, UserProfile
from .serializers import (
    RegisterSerializer, GoogleAuthSerializer, UserSerializer, SprintSerializer, 
    TaskSerializer, TaskCommentSerializer, TeamSerializer
)
from .permissions import SprintPermission, TaskPermission, IsTeamMember
from .analytics import (
    get_burndown, get_workload_distribution, get_velocity,
    get_bottlenecks, get_scope_creep, get_recommendations
)

class RegisterView(views.APIView):
    """
    Registers a new user and returns JWT tokens.
    Request body: username, password, email, role ('manager'/'member'), team_name.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            serializer = RegisterSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                refresh = RefreshToken.for_user(user)
                return Response({
                    "user": UserSerializer(user).data,
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as err:
            return Response(
                {"error": f"Registration server error: {str(err)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GoogleAuthView(views.APIView):
    """
    Authenticates a user via Google OAuth2 ID Token (Google Single Sign-On / SSID).
    Creates a new User & UserProfile if the user does not exist, and returns JWT tokens.
    Request body: { "token": "<google_id_token>", "role": "member", "team_name": "Team Alpha" }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            serializer = GoogleAuthSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            token = serializer.validated_data['token']
            role = serializer.validated_data.get('role', 'member')
            team_name = serializer.validated_data.get('team_name')

            id_info = None

            # Check for dev/testing mock token
            if token == "mock-google-token" or token.startswith("mock-"):
                id_info = {
                    'email': 'user.google@example.com',
                    'sub': '1234567890',
                    'given_name': 'Google',
                    'family_name': 'User',
                    'name': 'Google User',
                }
            else:
                try:
                    client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None)
                    # Verify token with Google
                    id_info = google_id_token.verify_oauth2_token(
                        token,
                        google_requests.Request(),
                        audience=client_id if client_id else None,
                        clock_skew_in_seconds=10
                    )
                except Exception as e:
                    return Response(
                        {"error": f"Invalid Google authentication token: {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            email = id_info.get('email')
            if not email:
                return Response(
                    {"error": "Google token is missing an email address."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Retrieve existing user or create a new one
            user = User.objects.filter(email=email).first()
            if not user:
                # Check by username prefix
                base_username = email.split('@')[0]
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1

                first_name = id_info.get('given_name', id_info.get('name', ''))
                last_name = id_info.get('family_name', '')

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name
                )
                user.set_unusable_password()
                user.save()

            # Handle UserProfile & Team assignment
            profile, created = UserProfile.objects.get_or_create(user=user)
            if role in ['manager', 'member']:
                profile.role = role

            if team_name and team_name.strip():
                team, _ = Team.objects.get_or_create(name=team_name.strip())
                profile.team = team
            elif created or not profile.team:
                # Create a team dedicated to this user if none specified
                default_team_name = f"{user.username}'s Team"
                team, _ = Team.objects.get_or_create(name=default_team_name)
                profile.team = team

            profile.save()

            refresh = RefreshToken.for_user(user)
            return Response({
                "user": UserSerializer(user).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }, status=status.HTTP_200_OK)
        except Exception as err:
            return Response(
                {"error": f"Google Auth server error: {str(err)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



class ProfileView(views.APIView):
    """
    Retrieves and updates the currently authenticated user's profile information (role, team).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        role = request.data.get('role')
        team_name = request.data.get('team_name')

        if role in ['manager', 'member']:
            profile.role = role

        if team_name and team_name.strip():
            team, _ = Team.objects.get_or_create(name=team_name.strip())
            profile.team = team

        profile.save()
        return Response(UserSerializer(request.user).data)


class TeamViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Provides read-only access to teams.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TeamSerializer
    queryset = Team.objects.all()


class SprintViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Sprints.
    - Managers can create, update, and delete sprints.
    - Members have read-only access.
    - Results are scoped to the user's team.
    """
    serializer_class = SprintSerializer
    permission_classes = [permissions.IsAuthenticated, SprintPermission]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'userprofile') or user.userprofile.team is None:
            return Sprint.objects.none()
        return Sprint.objects.filter(team=user.userprofile.team).order_by('start_date')

    def perform_create(self, serializer):
        user_team = self.request.user.userprofile.team
        serializer.save(team=user_team)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsTeamMember])
    def analytics(self, request, pk=None):
        """
        Calculates and returns the full suite of sprint analytics.
        Includes Burndown, Workload, Velocity, Bottlenecks, Scope Creep, and Recommendations.
        """
        sprint = self.get_object()
        
        burndown_data = get_burndown(sprint)
        workload_data = get_workload_distribution(sprint)
        velocity_data = get_velocity(sprint)
        bottleneck_data = get_bottlenecks(sprint)
        scope_creep_data = get_scope_creep(sprint)
        
        recommendations = get_recommendations(
            burndown=burndown_data,
            workload=workload_data,
            velocity=velocity_data,
            bottlenecks=bottleneck_data,
            scope_creep=scope_creep_data,
            sprint=sprint
        )

        return Response({
            "sprint_id": sprint.id,
            "sprint_name": sprint.name,
            "burndown": burndown_data,
            "workload": workload_data,
            "velocity": velocity_data,
            "bottlenecks": bottleneck_data,
            "scope_creep": scope_creep_data,
            "recommendations": recommendations
        })


class TaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Tasks.
    - Managers have full CRUD rights.
    - Members can only update status on tasks assigned to them.
    - Scoped by team.
    - Filters: ?sprint=<id>, ?assignee=<id>, ?status=<choices>
    """
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated, TaskPermission]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'userprofile') or user.userprofile.team is None:
            return Task.objects.none()
        
        queryset = Task.objects.filter(sprint__team=user.userprofile.team).order_by('created_at')
        
        sprint_id = self.request.query_params.get('sprint')
        if sprint_id:
            queryset = queryset.filter(sprint_id=sprint_id)
            
        assignee_id = self.request.query_params.get('assignee')
        if assignee_id:
            queryset = queryset.filter(assignee_id=assignee_id)
            
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        return queryset

    def perform_create(self, serializer):
        # Ensure that manager only creates task for sprints within their team
        sprint = serializer.validated_data['sprint']
        user_team = self.request.user.userprofile.team
        if sprint.team != user_team:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only create tasks for sprints in your team.")
        serializer.save()


class TaskCommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Task Comments.
    - Scoped by team.
    - Allows adding and viewing comments on team tasks.
    - Filter by task: ?task=<id>
    """
    serializer_class = TaskCommentSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeamMember]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'userprofile') or user.userprofile.team is None:
            return TaskComment.objects.none()
            
        queryset = TaskComment.objects.filter(task__sprint__team=user.userprofile.team).order_by('created_at')
        
        task_id = self.request.query_params.get('task')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
            
        return queryset

    def perform_create(self, serializer):
        task = serializer.validated_data['task']
        user_team = self.request.user.userprofile.team
        if task.sprint.team != user_team:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only comment on tasks within your team.")
        serializer.save(author=self.request.user)
