from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APITestCase
from rest_framework import status

from .models import Team, UserProfile, Sprint, Task
from .analytics import (
    get_burndown, get_workload_distribution, get_velocity,
    get_bottlenecks, get_scope_creep, get_recommendations
)

class SprintAnalyticsTests(TestCase):
    def setUp(self):
        # Create team
        self.team = Team.objects.create(name="Alpha Team")
        
        # Create team members
        self.manager_user = User.objects.create_user(username="manager_bob", password="password")
        UserProfile.objects.create(user=self.manager_user, role="manager", team=self.team)
        
        self.member_alice = User.objects.create_user(username="alice", password="password")
        UserProfile.objects.create(user=self.member_alice, role="member", team=self.team)

        self.member_charlie = User.objects.create_user(username="charlie", password="password")
        UserProfile.objects.create(user=self.member_charlie, role="member", team=self.team)

        # Create Sprint
        self.sprint_start = timezone.now().date() - timedelta(days=2)
        self.sprint_end = timezone.now().date() + timedelta(days=2)  # 5 days total
        self.sprint = Sprint.objects.create(
            team=self.team,
            name="Sprint 1",
            start_date=self.sprint_start,
            end_date=self.sprint_end,
            goal="Test Sprint",
            status="Active"
        )

    def test_analytics_metrics(self):
        # Task 1: assigned to alice, done. points=5. Created at sprint start.
        task1 = Task.objects.create(
            sprint=self.sprint,
            title="Task 1",
            assignee=self.member_alice,
            status="done",
            story_points=5,
            due_date=self.sprint_end
        )
        task1.created_at = timezone.make_aware(timezone.datetime.combine(self.sprint_start, timezone.datetime.min.time()))
        task1.completed_at = timezone.now() - timedelta(days=1)
        task1.save()

        # Task 2: assigned to charlie, in_progress. points=10. Created at start date.
        task2 = Task.objects.create(
            sprint=self.sprint,
            title="Task 2",
            assignee=self.member_charlie,
            status="in_progress",
            story_points=10,
            due_date=self.sprint_end
        )
        task2.created_at = timezone.make_aware(timezone.datetime.combine(self.sprint_start, timezone.datetime.min.time()))
        task2.status_updated_at = timezone.now() - timedelta(days=4)
        task2.save()

        # Task 3: scope creep task, created after sprint start. todo. points=5.
        task3 = Task.objects.create(
            sprint=self.sprint,
            title="Task 3",
            assignee=self.member_charlie,
            status="todo",
            story_points=5,
            due_date=self.sprint_end
        )
        task3.save()

        # Run burndown computations
        burndown = get_burndown(self.sprint)
        self.assertEqual(burndown["committed_points"], 15)  # task1 and task2 (created on start_date)
        
        # Run workload distribution
        workload = get_workload_distribution(self.sprint)
        self.assertEqual(workload["total_points"], 20)  # 5 + 10 + 5
        self.assertEqual(workload["team_average"], 6.7)
        
        charlie_stat = next(item for item in workload["workload"] if item["username"] == "charlie")
        self.assertEqual(charlie_stat["status"], "overloaded")
        
        # Run bottlenecks
        bottlenecks = get_bottlenecks(self.sprint, days_threshold=3)
        self.assertEqual(len(bottlenecks), 1)
        self.assertEqual(bottlenecks[0]["title"], "Task 2")

        # Run scope creep
        creep = get_scope_creep(self.sprint)
        self.assertEqual(creep["count"], 1)
        self.assertAlmostEqual(creep["percentage"], 33.3, places=1)

        # Run recommendations
        recommendations = get_recommendations(
            burndown=burndown,
            workload=workload,
            velocity=get_velocity(self.sprint),
            bottlenecks=bottlenecks,
            scope_creep=creep,
            sprint=self.sprint
        )
        self.assertTrue(any("charlie is carrying" in r for r in recommendations))
        self.assertTrue(any("stuck in 'In Progress'" in r for r in recommendations))


class SprintApiTests(APITestCase):
    def setUp(self):
        self.team = Team.objects.create(name="Beta Team")
        
        # Create users
        self.manager = User.objects.create_user(username="manager_alice", password="password")
        UserProfile.objects.create(user=self.manager, role="manager", team=self.team)
        
        self.member = User.objects.create_user(username="member_dave", password="password")
        UserProfile.objects.create(user=self.member, role="member", team=self.team)

        # Sprint
        self.sprint = Sprint.objects.create(
            team=self.team,
            name="Sprint Beta 1",
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=7),
            goal="API tests",
            status="Active"
        )
        
        # Task
        self.task = Task.objects.create(
            sprint=self.sprint,
            title="Dev Task",
            assignee=self.member,
            status="todo",
            story_points=5
        )

    def get_jwt_tokens(self, username, password):
        url = "/api/auth/login/"
        response = self.client.post(url, {"username": username, "password": password})
        return response.data["access"]

    def test_member_permissions(self):
        token = self.get_jwt_tokens("member_dave", "password")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Member should NOT be able to create a sprint
        sprint_url = "/api/sprints/"
        response = self.client.post(sprint_url, {
            "name": "Member Sprint",
            "start_date": "2026-07-01",
            "end_date": "2026-07-08",
            "goal": "Should fail",
            "status": "Planned"
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Member should NOT be able to modify task title, only status
        task_url = f"/api/tasks/{self.task.id}/"
        response = self.client.put(task_url, {
            "sprint": self.sprint.id,
            "title": "Hacked Title",
            "status": "in_progress",
            "assignee": self.member.id
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Dev Task")
        self.assertEqual(self.task.status, "in_progress")

    def test_manager_permissions(self):
        token = self.get_jwt_tokens("manager_alice", "password")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Manager CAN create a task
        task_url = "/api/tasks/"
        response = self.client.post(task_url, {
            "sprint": self.sprint.id,
            "title": "Manager Task",
            "status": "todo",
            "story_points": 8
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_google_auth_success(self):
        url = "/api/auth/google/"
        response = self.client.post(url, {
            "token": "mock-google-token",
            "role": "member",
            "team_name": "Beta Team"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["email"], "user.google@example.com")

