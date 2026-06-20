from django.http import JsonResponse, HttpResponse

def custom_404(request, exception):
    if request.path.startswith('/api/'):
        return JsonResponse({'success': False, 'message': 'API endpoint topilmadi.'}, status=404)
    return HttpResponse('<h1>404 Not Found</h1><p>The requested URL was not found on this server.</p>', status=404, content_type='text/html')
