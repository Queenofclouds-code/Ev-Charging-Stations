from django.contrib.gis.db import models

class StationCharging(models.Model):
    class Meta:
        db_table = 'Final_EV_stations'
    id = models.AutoField(primary_key=True)
    geom = models.PointField(srid=4326)  # Spatial field for storing geometry (lat/lng)
    fid = models.BigIntegerField()
    name = models.CharField(max_length=255, db_column="Charging Station")
    status = models.CharField(max_length=50)
    usage_type = models.CharField(max_length=100)
    operator = models.CharField(max_length=255, blank=True, null=True)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    connection_type = models.CharField(max_length=100)
    connection_level = models.CharField(max_length=100)
    current_type = models.CharField(max_length=50)
    latitude = models.FloatField()
    longitude = models.FloatField()
    charging_points = models.IntegerField(db_column="Charging Points")

    def __str__(self):
        return self.name
    

