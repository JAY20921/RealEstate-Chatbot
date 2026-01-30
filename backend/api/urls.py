from django.urls import path
from . import views

urlpatterns = [
    path("upload/", views.upload_file, name="upload_file"),
    path("query/", views.query_view, name="query_view"),
    path("areas/", views.list_areas, name="list_areas"),
    path("dashboard/", views.dashboard_stats, name="dashboard_stats"),
]
