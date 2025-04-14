from django.contrib import admin
from .models import StationCharging

@admin.register(StationCharging)
class StationAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "state", "status", "connection_type", "charging_points")
    search_fields = ("name", "city", "state")




