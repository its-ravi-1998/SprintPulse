from django.contrib import admin
from .models import Sprint, Task, Team, UserProfile, TaskComment

admin.site.register(Team)
admin.site.register(UserProfile)
admin.site.register(Sprint)
admin.site.register(Task)
admin.site.register(TaskComment)
