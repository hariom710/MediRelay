#!/usr/bin/env python
import os, django, time, statistics
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
print("BACKEND PERFORMANCE BASELINE v2 (with query counts)")
print("=" * 60)

results = {}
for url in endpoints:
    # Warm up
    client.get(url)
    
    # Measure 3 requests and count queries from last request
    times = []
    for _ in range(3):
        start = time.time()
        r = client.get(url)
        elapsed = time.time() - start
        times.append(elapsed)
    
    # connection.queries is populated after each request
    # Count only the queries from the last request by using the last entries
    # The queries list accumulates, so we track before/after
    query_before = len(connection.queries)
    # Make one more request to get clean query count for this endpoint
    r = client.get(url)
    query_after = len(connection.queries)
    last_query_count = query_after - query_before
    avg_time = (sum(times) / len(times)) * 1000 if times else 0
    per_request_avg = last_query_count / len(times) if times else 0

    results[url] = {
        'avg_time': avg_time,
        'total_queries': last_query_count,
        'per_request_avg': per_request_avg,
    }
    print(f"  {url}: {results[url]['avg_time']:.1f}ms avg, {results[url]['per_request_avg']:.1f} queries/req (last request: {last_query_count} queries)")

print()
print("Summary:")
for url, r in results.items():
    print(f"  {url}: {r['avg_time']:.1f}ms avg, {r['per_request_avg']:.1f} queries/req")

print("=" * 60)