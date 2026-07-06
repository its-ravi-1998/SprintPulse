import os
# pyrefly: ignore [missing-import]
import django
from datetime import timedelta

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sprintpulse.settings')
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from sprint.models import Team, UserProfile, Sprint, Task, TaskComment

def seed_db():
    print("Deleting existing database records...")
    TaskComment.objects.all().delete()
    Task.objects.all().delete()
    Sprint.objects.all().delete()
    UserProfile.objects.all().delete()
    User.objects.all().delete()
    Team.objects.all().delete()

    print("Creating Team...")
    team = Team.objects.create(name="Phoenix Team")

    print("Creating Users & Profiles...")
    # Manager
    manager_user = User.objects.create_user(username="manager", email="manager@example.com", password="password123")
    manager_user.first_name = "Sarah"
    manager_user.last_name = "Connor"
    manager_user.save()
    UserProfile.objects.create(user=manager_user, role="manager", team=team)

    # Members
    alice_user = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
    alice_user.first_name = "Alice"
    alice_user.last_name = "Smith"
    alice_user.save()
    UserProfile.objects.create(user=alice_user, role="member", team=team)

    bob_user = User.objects.create_user(username="bob", email="bob@example.com", password="password123")
    bob_user.first_name = "Bob"
    bob_user.last_name = "Jones"
    bob_user.save()
    UserProfile.objects.create(user=bob_user, role="member", team=team)

    charlie_user = User.objects.create_user(username="charlie", email="charlie@example.com", password="password123")
    charlie_user.first_name = "Charlie"
    charlie_user.last_name = "Brown"
    charlie_user.save()
    UserProfile.objects.create(user=charlie_user, role="member", team=team)

    today = timezone.now().date()

    print("Creating Past Completed Sprint (for velocity)...")
    sprint1_start = today - timedelta(days=20)
    sprint1_end = today - timedelta(days=10)
    sprint1 = Sprint.objects.create(
        team=team,
        name="Sprint 1 (Legacy Core)",
        start_date=sprint1_start,
        end_date=sprint1_end,
        goal="Initialize the repository and scaffold database models.",
        status="Completed"
    )

    # Sprint 1 Tasks (all completed)
    t1_s1 = Task.objects.create(
        sprint=sprint1, title="Scaffold Django app", assignee=alice_user, status="done", story_points=8, due_date=sprint1_end
    )
    t1_s1.created_at = timezone.make_aware(timezone.datetime.combine(sprint1_start, timezone.datetime.min.time()))
    t1_s1.completed_at = timezone.make_aware(timezone.datetime.combine(sprint1_start + timedelta(days=3), timezone.datetime.min.time()))
    t1_s1.save()

    t2_s1 = Task.objects.create(
        sprint=sprint1, title="Configure PostgreSQL connection", assignee=bob_user, status="done", story_points=5, due_date=sprint1_end
    )
    t2_s1.created_at = timezone.make_aware(timezone.datetime.combine(sprint1_start, timezone.datetime.min.time()))
    t2_s1.completed_at = timezone.make_aware(timezone.datetime.combine(sprint1_start + timedelta(days=5), timezone.datetime.min.time()))
    t2_s1.save()

    t3_s1 = Task.objects.create(
        sprint=sprint1, title="Write initial unit tests", assignee=charlie_user, status="done", story_points=12, due_date=sprint1_end
    )
    t3_s1.created_at = timezone.make_aware(timezone.datetime.combine(sprint1_start, timezone.datetime.min.time()))
    t3_s1.completed_at = timezone.make_aware(timezone.datetime.combine(sprint1_start + timedelta(days=8), timezone.datetime.min.time()))
    t3_s1.save()

    print("Creating Active Sprint...")
    sprint2_start = today - timedelta(days=4)
    sprint2_end = today + timedelta(days=6)
    sprint2 = Sprint.objects.create(
        team=team,
        name="Sprint 2 (API & Board UI)",
        start_date=sprint2_start,
        end_date=sprint2_end,
        goal="Deliver core API documentation, JWT auth, and dashboard UI.",
        status="Active"
    )

    print("Creating Active Tasks...")
    # Tasks created at start of Sprint 2
    tasks_start_time = timezone.make_aware(timezone.datetime.combine(sprint2_start, timezone.datetime.min.time()))

    # Task 1: Alice, Done (5 pts)
    t1 = Task.objects.create(
        sprint=sprint2, title="Design database schema", assignee=alice_user, status="done", story_points=5, due_date=sprint2_end
    )
    t1.created_at = tasks_start_time
    t1.completed_at = timezone.now() - timedelta(days=3)
    t1.save()

    # Task 2: Alice, Done (3 pts)
    t2 = Task.objects.create(
        sprint=sprint2, title="Setup JWT Authentication", assignee=alice_user, status="done", story_points=3, due_date=sprint2_end
    )
    t2.created_at = tasks_start_time
    t2.completed_at = timezone.now() - timedelta(days=2)
    t2.save()

    # Task 3: Alice, In Progress (8 pts) - active
    t3 = Task.objects.create(
        sprint=sprint2, title="Implement analytics API", assignee=alice_user, status="in_progress", story_points=8, due_date=sprint2_end
    )
    t3.created_at = tasks_start_time
    t3.status_updated_at = timezone.now() - timedelta(hours=12)
    t3.save()

    # Task 3b: Alice, In Progress (8 pts) - overloaded!
    t3b = Task.objects.create(
        sprint=sprint2, title="Create custom authorization handlers", assignee=alice_user, status="in_progress", story_points=8, due_date=sprint2_end
    )
    t3b.created_at = tasks_start_time
    t3b.status_updated_at = timezone.now() - timedelta(hours=18)
    t3b.save()

    # Task 4: Bob, In Progress (5 pts) - stuck bottleneck! (status updated 4 days ago)
    t4 = Task.objects.create(
        sprint=sprint2, title="Create Kanban Board UI", assignee=bob_user, status="in_progress", story_points=5, due_date=sprint2_end
    )
    t4.created_at = tasks_start_time
    t4.status_updated_at = timezone.now() - timedelta(days=4)
    t4.save()

    # Task 5: Bob, To Do (3 pts)
    t5 = Task.objects.create(
        sprint=sprint2, title="Write end-to-end integration tests", assignee=bob_user, status="todo", story_points=3, due_date=sprint2_end
    )
    t5.created_at = tasks_start_time
    t5.status_updated_at = tasks_start_time
    t5.save()

    # Task 6: Charlie, To Do (3 pts)
    t6 = Task.objects.create(
        sprint=sprint2, title="Integrate swagger docs in UI", assignee=charlie_user, status="todo", story_points=3, due_date=sprint2_end
    )
    t6.created_at = tasks_start_time
    t6.status_updated_at = tasks_start_time
    t6.save()

    # Task 7: Charlie, To Do (5 pts)
    t7 = Task.objects.create(
        sprint=sprint2, title="Configure production settings", assignee=charlie_user, status="todo", story_points=5, due_date=sprint2_end
    )
    t7.created_at = tasks_start_time
    t7.status_updated_at = tasks_start_time
    t7.save()

    # Task 8: Charlie, To Do (3 pts) - scope creep (created 2 days ago)
    creep_time = timezone.now() - timedelta(days=2)
    t8 = Task.objects.create(
        sprint=sprint2, title="Implement dark mode styling", assignee=charlie_user, status="todo", story_points=3, due_date=sprint2_end
    )
    t8.created_at = creep_time
    t8.status_updated_at = creep_time
    t8.save()

    print("Adding Comments...")
    TaskComment.objects.create(
        task=t4,
        author=manager_user,
        content="Hey Bob, is there any blocker on this board UI? It's been in progress for a few days."
    )
    TaskComment.objects.create(
        task=t4,
        author=bob_user,
        content="Yes, I'm having issues with the drag-and-drop React library. Resolving package conflicts now."
    )
    TaskComment.objects.create(
        task=t3,
        author=alice_user,
        content="Analytics computations are done! Moving on to serialization and response caching."
    )

    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_db()
