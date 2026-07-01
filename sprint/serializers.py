from rest_framework import serializers
from .models import Sprint, Task


class SprintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sprint
        fields = '_all_'


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = '_all_'