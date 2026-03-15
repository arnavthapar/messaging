async function loadUsername() {
    const username = await fetch('/api/get_username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    const result = await username.json();
    document.getElementById('username').textContent = result.username;
    return result.username;
}
loadUsername();
document.getElementById('deleteForm').onsubmit = async (e) => {
    e.preventDefault();
    if (document.getElementById('deleteUsernameInput').value !== await loadUsername()) {
        document.getElementById('deleteStatus').textContent = 'Username does not match. Please type your username to confirm.';
        return;
    } else {
        const res = await fetch('/api/delete_account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
            document.getElementById('deleteStatus').textContent = 'Your account is gone. ): Redirecting...';
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            document.getElementById('deleteStatus').textContent = 'Failed to delete account. Yeah, your account is staying. What are you going to do about it?';
        }
    }
}
document.getElementById('backButton').addEventListener('click', () => {
    location.href = '/home';
});
document.getElementById('timeFormat').onclick = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/change_time_format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        });
    if (!res.ok) {
        document.getElementById('status').textContent = 'Failed to change time format.';
    }
}
document.getElementById('24hour').onclick = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/change_hour_format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        });
    if (!res.ok) {
        document.getElementById('status').textContent = 'Failed to change hour format.';
    }
}

document.getElementById('usernameForm').onsubmit = async (e) => {
    e.preventDefault();
    // Get the clicked submit button
    const submitter = e.submitter;
    const action = submitter?.value;
    if (action !== 'send') {
        return;
    }
    const res = await fetch('/api/change_username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById('usernameInput').value
        })
    })
    if (res.ok) {
        document.getElementById('status').textContent = 'Username changed!';
    } else if (res.status === 413) {
        document.getElementById('status').textContent = 'Username cannot exceed 50 characters.';
    } else if (res.status === 400) {
        data = await res.json();
        document.getElementById('status').textContent = data.message;
    } else {
        document.getElementById('status').textContent = 'Failed to change username.';
    }
    loadMessages();
};
