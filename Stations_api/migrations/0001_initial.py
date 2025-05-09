# Generated by Django 4.2.11 on 2025-03-25 17:20

import django.contrib.gis.db.models.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='ChargingStation',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('geom', django.contrib.gis.db.models.fields.PointField(srid=4326)),
                ('fid', models.BigIntegerField()),
                ('name', models.CharField(db_column='Charging Station', max_length=255)),
                ('status', models.CharField(max_length=50)),
                ('usage_type', models.CharField(max_length=100)),
                ('operator', models.CharField(blank=True, max_length=255, null=True)),
                ('address', models.TextField()),
                ('city', models.CharField(max_length=100)),
                ('state', models.CharField(max_length=100)),
                ('connection_type', models.CharField(max_length=100)),
                ('connection_level', models.CharField(max_length=100)),
                ('current_type', models.CharField(max_length=50)),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('charging_points', models.IntegerField()),
            ],
        ),
    ]
