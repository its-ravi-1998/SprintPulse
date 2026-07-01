from rest_framework.response import Response
from rest_framework.decorators import api_view
from .models import Sprint, Task
from .serializers import SprintSerializer, TaskSerializer


@api_view(['GET', 'POST'])
def sprint_list(request):

    if request.method == 'GET':
        sprints = Sprint.objects.all()
        serializer = SprintSerializer(sprints, many=True)
        return Response(serializer.data)

    serializer = SprintSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors)


@api_view(['GET', 'POST'])
def task_list(request):

    if request.method == 'GET':
        tasks = Task.objects.all()
        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data)

    serializer = TaskSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors)
@api_view(['PUT'])
def update_sprint(request, pk):
    sprint = Sprint.objects.get(id=pk)
    serializer = SprintSerializer(sprint, data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors)


@api_view(['DELETE'])
def delete_sprint(request, pk):
    sprint = Sprint.objects.get(id=pk)
    sprint.delete()
    return Response({"message": "Sprint deleted successfully"})


@api_view(['PUT'])
def update_task(request, pk):
    task = Task.objects.get(id=pk)
    serializer = TaskSerializer(task, data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors)


@api_view(['DELETE'])
def delete_task(request, pk):
    task = Task.objects.get(id=pk)
    task.delete()
    return Response({"message": "Task deleted successfully"})
