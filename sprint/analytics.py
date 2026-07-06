from django.db.models import Sum, Q
from django.utils import timezone
from datetime import timedelta, date
from .models import Sprint, Task

def get_burndown(sprint):
    """
    Computes burndown metrics for a sprint.
    Returns actual and ideal remaining story points for each day of the sprint.
    """
    start_date = sprint.start_date
    end_date = sprint.end_date
    duration_days = (end_date - start_date).days + 1
    
    if duration_days <= 0:
        duration_days = 1

    # Total points committed at start (created on or before start_date)
    # We fallback to all tasks in the sprint if none were created before start date,
    # but strictly we filter by created_at.
    committed_tasks = sprint.tasks.filter(created_at__date__lte=start_date)
    total_committed_points = committed_tasks.aggregate(total=Sum('story_points'))['total'] or 0
    
    # If no points are committed, fallback to total points in the sprint currently
    if total_committed_points == 0:
        total_committed_points = sprint.tasks.aggregate(total=Sum('story_points'))['total'] or 0

    today = timezone.now().date()
    burndown_series = []

    for i in range(duration_days):
        current_date = start_date + timedelta(days=i)
        
        # Calculate ideal remaining
        if duration_days > 1:
            ideal_remaining = total_committed_points * (1 - i / (duration_days - 1))
        else:
            ideal_remaining = 0
            
        # Calculate actual remaining
        if current_date <= today:
            # Active tasks as of current_date
            tasks_as_of_date = sprint.tasks.filter(created_at__date__lte=current_date)
            # Completed tasks as of current_date
            completed_points_by_date = tasks_as_of_date.filter(
                status='done', 
                completed_at__date__lte=current_date
            ).aggregate(total=Sum('story_points'))['total'] or 0
            
            # Total tasks points as of current_date
            total_points_by_date = tasks_as_of_date.aggregate(total=Sum('story_points'))['total'] or 0
            
            actual_remaining = total_points_by_date - completed_points_by_date
        else:
            actual_remaining = None

        burndown_series.append({
            "day": i,
            "date": current_date.strftime("%Y-%m-%d"),
            "ideal": round(max(0.0, ideal_remaining), 1),
            "actual": round(max(0.0, actual_remaining), 1) if actual_remaining is not None else None
        })

    return {
        "committed_points": total_committed_points,
        "series": burndown_series
    }


def get_workload_distribution(sprint):
    """
    Computes workload distribution among team members.
    Flags individuals carrying > 1.5x average points as 'overloaded'
    and < 0.5x average points as 'underloaded'.
    """
    OVERLOAD_THRESHOLD = 1.5
    UNDERLOAD_THRESHOLD = 0.5

    # Get team members
    from django.contrib.auth.models import User
    team_users = User.objects.filter(userprofile__team=sprint.team)
    assignee_count = team_users.count()

    workload_list = []
    total_points = 0

    for user in team_users:
        user_tasks = sprint.tasks.filter(assignee=user)
        points = user_tasks.aggregate(total=Sum('story_points'))['total'] or 0
        task_count = user_tasks.count()
        
        workload_list.append({
            "user_id": user.id,
            "username": user.username,
            "full_name": user.get_full_name() or user.username,
            "story_points": points,
            "task_count": task_count,
            "status": "normal"
        })
        total_points += points

    # Unassigned tasks summary
    unassigned_tasks = sprint.tasks.filter(assignee__isnull=True)
    unassigned_points = unassigned_tasks.aggregate(total=Sum('story_points'))['total'] or 0
    unassigned_count = unassigned_tasks.count()
    
    if unassigned_count > 0:
        workload_list.append({
            "user_id": None,
            "username": "Unassigned",
            "full_name": "Unassigned Tasks",
            "story_points": unassigned_points,
            "task_count": unassigned_count,
            "status": "unassigned"
        })

    avg_points = (total_points / assignee_count) if assignee_count > 0 else 0

    # Determine overload / underload status
    for item in workload_list:
        if item["user_id"] is not None and avg_points > 0:
            user_points = item["story_points"]
            if user_points > avg_points * OVERLOAD_THRESHOLD:
                item["status"] = "overloaded"
            elif user_points < avg_points * UNDERLOAD_THRESHOLD:
                item["status"] = "underloaded"

    return {
        "workload": workload_list,
        "team_average": round(avg_points, 1),
        "total_points": total_points
    }


def get_velocity(sprint):
    """
    Computes velocity for completed sprints of the team.
    Also returns the average velocity of the last 3 sprints.
    """
    completed_sprints = Sprint.objects.filter(
        team=sprint.team, 
        status='Completed'
    ).order_by('end_date')

    history = []
    for s in completed_sprints:
        points = s.tasks.filter(status='done').aggregate(total=Sum('story_points'))['total'] or 0
        history.append({
            "sprint_id": s.id,
            "sprint_name": s.name,
            "end_date": s.end_date.strftime("%Y-%m-%d"),
            "completed_points": points
        })

    # Average of last 3 sprints
    last_3 = history[-3:]
    avg_velocity = (sum(v['completed_points'] for v in last_3) / len(last_3)) if last_3 else 0

    return {
        "history": history,
        "average_velocity_last_3": round(avg_velocity, 1)
    }


def get_bottlenecks(sprint, days_threshold=3):
    """
    Finds tasks that are in 'in_progress' and have not changed status for N days.
    """
    cutoff = timezone.now() - timedelta(days=days_threshold)
    stuck_tasks = sprint.tasks.filter(
        status='in_progress', 
        status_updated_at__lt=cutoff
    )

    bottlenecks = []
    for task in stuck_tasks:
        if task.status_updated_at:
            days_stuck = round((timezone.now() - task.status_updated_at).total_seconds() / 86400, 1)
        else:
            days_stuck = 0.0
        
        assignee_name = "Unassigned"
        if task.assignee:
            assignee_name = task.assignee.get_full_name() or task.assignee.username

        bottlenecks.append({
            "task_id": task.id,
            "title": task.title,
            "assignee_name": assignee_name,
            "days_stuck": days_stuck
        })

    return bottlenecks


def get_scope_creep(sprint):
    """
    Finds tasks created after the sprint start date.
    """
    scope_creep_tasks = sprint.tasks.filter(created_at__date__gt=sprint.start_date)
    total_tasks = sprint.tasks.count()
    scope_creep_count = scope_creep_tasks.count()
    percentage = (scope_creep_count / total_tasks * 100) if total_tasks > 0 else 0

    return {
        "count": scope_creep_count,
        "total_tasks": total_tasks,
        "percentage": round(percentage, 1)
    }


def get_recommendations(burndown, workload, velocity, bottlenecks, scope_creep, sprint):
    """
    Generates plain-language alerts and recommendations based on metrics values.
    """
    recommendations = []

    # 1. Burndown checks
    today = timezone.now().date()
    # Find latest actual remaining that is available
    latest_actual = None
    latest_ideal = None
    for entry in reversed(burndown["series"]):
        if entry["actual"] is not None:
            latest_actual = entry["actual"]
            latest_ideal = entry["ideal"]
            break

    if latest_actual is not None and latest_ideal is not None and latest_ideal > 0:
        if latest_actual > latest_ideal * 1.2:
            lag = latest_actual - latest_ideal
            recommendations.append(
                f"Sprint is behind the ideal burndown pace by {round(lag, 1)} points. "
                "Consider scope adjustment or prioritizing critical items."
            )

    # 2. Workload distribution checks
    avg_points = workload["team_average"]
    for person in workload["workload"]:
        if person["user_id"] is not None:
            if person["status"] == "overloaded":
                recommendations.append(
                    f"{person['full_name']} is carrying {person['story_points']} points, "
                    f"well above the team average of {avg_points:.1f}. Consider redistributing tasks."
                )
            elif person["status"] == "underloaded" and avg_points > 10:
                # Only warn if team average is reasonable, to avoid false alerts when starting sprints
                recommendations.append(
                    f"{person['full_name']} is carrying {person['story_points']} points, "
                    f"which is below team average. Check if they have capacity for more tasks."
                )

    # 3. Scope Creep checks
    if scope_creep["percentage"] > 20:
        recommendations.append(
            f"{scope_creep['percentage']:.0f}% of this sprint's tasks were added after the sprint started. "
            "Review planning process to prevent scope creep."
        )

    # 4. Bottlenecks checks
    stuck_count = len(bottlenecks)
    if stuck_count > 0:
        stuck_titles = ", ".join([f"'{b['title']}' ({b['assignee_name']})" for b in bottlenecks[:2]])
        if stuck_count > 2:
            stuck_titles += f" and {stuck_count - 2} more"
        recommendations.append(
            f"{stuck_count} task(s) have been stuck in 'In Progress' for over 3 days: "
            f"{stuck_titles}. Check for active blockers."
        )

    # 5. General health checks
    days_to_end = (sprint.end_date - today).days
    if 0 <= days_to_end <= 2 and sprint.status == 'Active':
        incomplete_count = sprint.tasks.exclude(status='done').count()
        if incomplete_count > 0:
            recommendations.append(
                f"Sprint ends in {days_to_end} days with {incomplete_count} unfinished tasks. "
                "Ensure roll-over decisions or wrap-up pushes are initiated."
            )

    if not sprint.tasks.filter(status='in_progress').exists() and sprint.tasks.filter(status='todo').exists():
        recommendations.append(
            "No tasks are currently in progress, but tasks remain in the backlog. "
            "Remind the team to pull the next task from 'To Do'."
        )

    # Default friendly message if everything is clean
    if not recommendations:
        recommendations.append(
            "Sprint metrics look healthy! Keep up the good work and ensure task statuses are kept up to date."
        )

    return recommendations
