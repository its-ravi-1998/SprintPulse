from django.db import models
from django.contrib.auth.models import User


class Sprint(models.Model):
    sprint_name = models.CharField(max_length=100)
    goal = models.TextField()
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=[
            ('Planned', 'Planned'),
            ('Active', 'Active'),
            ('Completed', 'Completed')
        ]
    )

    def _str_(self):
        return self.sprint_name


class Task(models.Model):
    sprint = models.ForeignKey(Sprint, on_delete=models.CASCADE)
    assigned_to = models.ForeignKey(User, on_delete=models.CASCADE)

    task_name = models.CharField(max_length=100)
    description = models.TextField()

    priority = models.CharField(
        max_length=20,
        choices=[
            ('Low', 'Low'),
            ('Medium', 'Medium'),
            ('High', 'High')
        ]
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ('To Do', 'To Do'),
            ('In Progress', 'In Progress'),
            ('Done', 'Done')
        ]
    )

    due_date = models.DateField()

    def _str_(self):
        return self.task_name
