from rest_framework import permissions

class IsTeamMember(permissions.BasePermission):
    """
    Ensures that the user belongs to the team that owns the object.
    For Sprint, it checks sprint.team.
    For Task, it checks task.sprint.team.
    For TaskComment, it checks comment.task.sprint.team.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not hasattr(user, 'userprofile') or user.userprofile.team is None:
            return False
        
        user_team = user.userprofile.team
        
        # Determine the team for the object
        from .models import Sprint, Task, TaskComment
        if isinstance(obj, Sprint):
            return obj.team == user_team
        elif isinstance(obj, Task):
            return obj.sprint.team == user_team
        elif isinstance(obj, TaskComment):
            return obj.task.sprint.team == user_team
        
        return False


class SprintPermission(permissions.BasePermission):
    """
    Sprint permission rules:
    - Safe methods (GET, HEAD, OPTIONS): open to both manager and member of the same team.
    - Write methods (POST, PUT, PATCH, DELETE): manager only.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Write operations need manager role
        return hasattr(request.user, 'userprofile') and request.user.userprofile.role == 'manager'

    def has_object_permission(self, request, view, obj):
        # First ensure team match
        if not hasattr(request.user, 'userprofile') or request.user.userprofile.team is None:
            return False
        if obj.team != request.user.userprofile.team:
            return False
            
        if request.method in permissions.SAFE_METHODS:
            return True
            
        return request.user.userprofile.role == 'manager'


class TaskPermission(permissions.BasePermission):
    """
    Task permission rules:
    - Safe methods: open to team members.
    - Create/Delete: manager only.
    - Update:
      - Manager can update anything.
      - Member can update status only, and only if the task is assigned to them.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        # We allow POST for managers
        if request.method == 'POST':
            return hasattr(request.user, 'userprofile') and request.user.userprofile.role == 'manager'
            
        return True

    def has_object_permission(self, request, view, obj):
        if not hasattr(request.user, 'userprofile') or request.user.userprofile.team is None:
            return False
            
        user_profile = request.user.userprofile
        
        # Check team match
        if obj.sprint.team != user_profile.team:
            return False
            
        if request.method in permissions.SAFE_METHODS:
            return True
            
        if request.method == 'DELETE':
            return user_profile.role == 'manager'
            
        # Update (PUT, PATCH)
        if user_profile.role == 'manager':
            return True
            
        # If member: must be the assignee
        if user_profile.role == 'member':
            # Check if task is assigned to the member
            if obj.assignee != request.user:
                return False
            
            # Member can update, field limits checked in serializer
            return True
            
        return False
