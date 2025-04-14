from django.urls import path
from .views import StationList,index, get_directions
from .import views

urlpatterns = [
    path('api/stations/', views.StationList.as_view(), name='station-list'),
    path('api/directions/', views.get_directions, name='get-directions'),
    path('api/optimize-route/', views.optimize_route, name='optimize-route'),  # Add this line
    path('', views.index, name='index'),
]
