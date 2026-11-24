#!/usr/bin/env python
"""Backend performance benchmark for MediRelay."""
import os, django, time, statistics
from django.test.client import Client
from django.db import connection

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

client = Client()

# We need to set up test data to get meaningful results
# Let's benchmark the endpoints that work without auth first

endpoints = [
    '/api/v1/prescriptions',
    '/api/v1/pharmacy/inventory',
    '/api/v1/orders/list',
    '/api/v1/notifications',
    '/api/v1/pharmacy/requests',
]

print("=" * 60)
print("BACKEND PERFORMANCE AFTER OPTIMIZATION")
print("=" * 60)

results = {}
for url in endpoints:
    # Count queries before
    queries_before = len(connection.queries)
    
    # Warm up
    client.get(url)
    
    # Measure 3 requests
    times = []
    for _ in range(3):
        start = time.time()
        r = client.get(url)
        elapsed = time.time() - start
        times.append(elapsed)
    
    # Count queries from the last request
    # Reset and get clean measurement
    queries_after = len(connection.queries)
    last_query_count = queries_after - queries_before
    
    avg_time = (sum(times) / len(times)) * 1000 if times else 0
    per_request_avg = last_query_count / len(times) if times else 0

    results[url] = {
        'avg_time': avg_time,
        'total_queries': last_query_count,
        'per_request_avg': per_request_avg,
    }
    print(f"  {url}: {results[url]['avg_time']:.1f}ms avg, {results[url]['per_request_avg']:.1f} queries/req")

print()
print("Summary of query counts per endpoint:")
for url, r in results.items():
    print(f"  {url}: {r['total_queries']} queries total, {r['per_request_avg']:.1f} avg per request")

print("=" * 60)