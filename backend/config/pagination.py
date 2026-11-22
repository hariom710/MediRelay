from rest_framework.pagination import PageNumberPagination


class MediRelayPagination(PageNumberPagination):
    """Standard pagination for MediRelay API endpoints.

    Limits page size requests to a maximum of 100 items to prevent
    resource exhaustion / pagination abuse.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100
