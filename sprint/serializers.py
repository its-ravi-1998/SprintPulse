from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Team, UserProfile, Sprint, Task, TaskComment

class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['id', 'name', 'code']


class UserProfileSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True)
    team_code = serializers.CharField(source='team.code', read_only=True)
    
    class Meta:
        model = UserProfile
        fields = ['role', 'team', 'team_name', 'team_code']


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(source='userprofile', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=['manager', 'member'], default='member')
    team_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    team_code = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def create(self, validated_data):
        username = validated_data['username']
        password = validated_data['password']
        email = validated_data.get('email', '')
        role = validated_data.get('role', 'member')
        team_name = validated_data.get('team_name', '')
        team_code = validated_data.get('team_code', '')

        # Create user
        user = User.objects.create_user(username=username, email=email, password=password)
        
        # Resolve team by code if provided, otherwise by name or auto-generate
        team = None
        if team_code and team_code.strip():
            team = Team.objects.filter(code=team_code.strip().upper()).first()
            if not team:
                raise serializers.ValidationError({"team_code": "Invalid Team Code. Please ask your Project Manager for the correct 6-digit code."})
        elif team_name and team_name.strip():
            team, _ = Team.objects.get_or_create(name=team_name.strip())
        else:
            default_name = f"{user.username}'s Team"
            team, _ = Team.objects.get_or_create(name=default_name)

        # Create UserProfile
        UserProfile.objects.create(user=user, role=role, team=team)
        return user


class GoogleAuthSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    role = serializers.ChoiceField(choices=['manager', 'member'], required=False, default='member')
    team_name = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    team_code = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)



class SprintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sprint
        fields = ['id', 'team', 'name', 'start_date', 'end_date', 'goal', 'status']
        
    def validate(self, attrs):
        start_date = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') or (self.instance.end_date if self.instance else None)
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError("End date cannot be before start date.")
        return attrs


class TaskCommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'author', 'author_username', 'content', 'created_at']
        read_only_fields = ['author', 'created_at']


class TaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.username', read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'sprint', 'title', 'description', 'assignee', 'assignee_name',
            'status', 'story_points', 'created_at', 'status_updated_at', 'completed_at', 'due_date', 'comments'
        ]
        read_only_fields = ['created_at', 'status_updated_at', 'completed_at']

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and request.user:
            profile = getattr(request.user, 'userprofile', None)
            if profile and profile.role == 'member':
                # Member role: only status update allowed. Remove all other fields.
                for field in list(validated_data.keys()):
                    if field != 'status':
                        validated_data.pop(field)
        return super().update(instance, validated_data)