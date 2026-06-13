from rest_framework.response import Response

def success_response(data=None, message="Muvaffaqiyatli", status_code=200):
    """
    Standard successful response helper
    """
    return Response(
        {
            "success": True,
            "message": message,
            "data": data
        },
        status=status_code
    )

def error_response(message="Xatolik yuz berdi", errors=None, status_code=400):
    """
    Standard error response helper
    """
    return Response(
        {
            "success": False,
            "message": message,
            "errors": errors
        },
        status=status_code
    )
