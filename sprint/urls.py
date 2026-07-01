from django.urls import path
from .views import (
    sprint_list,
    task_list,
    update_sprint,
    delete_sprint,
    update_task,
    delete_task,
)

urlpatterns = [
    path('sprints/', sprint_list),
    path('tasks/', task_list),

    path('sprints/update/<int:pk>/', update_sprint),
    path('sprints/delete/<int:pk>/', delete_sprint),

    path('tasks/update/<int:pk>/', update_task),
    path('tasks/delete/<int:pk>/', delete_task),
]