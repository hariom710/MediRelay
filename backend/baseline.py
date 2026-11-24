#!/usr/bin/env python
import os, django, json, time, statistics
from django.test.client import Client
from django.db import connection

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

client = Client()

endpoints = [
    '/api/v1/auth/me',
    '/api/v1/prescriptions',
    '/api/v1/pharmacy/inventory',
    '/api/v1/orders/list',
    '/api/v1/notifications',
    '/api/v1/pharmacy/requests',
]

print("=" * 60)
print("BACKEND PERFORMANCE BASELINE")
print("=" * 60)

results = {}
for url in endpoints:
    # Warm up
    client.get(url)
    
    # Measure 5 requests
    times = []
    query_counts = []
    for _ in range(5):
        start = time.time()
        r = client.get(url)
        elapsed = time.time() - start
        times.append(elapsed)
        
        # Count queries
        query_count = len(connection.queries)
        query_counts.append(query_count)
    
    results[url] = {
        'avg_time': statistics.mean(times) * 1000,  # ms
        'avg_queries': statistics.mean(query_counts),
        'min_time': min(times) * 1000,
        'max_time': max(times) * 1000,
    }
    print(f"  {url}: {results[url]['avg_time']:.1f}ms avg, {results[url]['avg_queries']:.0f} queries avg")

print()
print("Summary:")
for url, r in results.items():
    print(f"  {url}: {r['avg_time']:.0f}ms, {r['avg_queries']:.0f} queries")

print("=" * 60)