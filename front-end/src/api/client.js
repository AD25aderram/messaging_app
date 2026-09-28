async function apiFetch(url, options = {}) {
    let response = await fetch(url, {
        ...options,
        credentials: 'include'
    });

    // Access token expired
    if (response.status === 401) {
        const refreshResponse = await fetch('http://localhost:8080/auth/token', {
            method: 'GET',
            credentials: 'include'
        });

        // Refresh successful, retry original request
        if (refreshResponse.ok) {
            response = await fetch(url, {
                ...options,
                credentials: 'include'
            });
        }
    }

    return response;

}

export default apiFetch;
