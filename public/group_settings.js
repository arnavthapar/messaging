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
document.getElementById('deleteGroupForm').onsubmit = async (e) => {
    e.preventDefault();
    if (document.getElementById('deleteGroupInput').value !== await loadUsername()) {
        document.getElementById('deleteStatus').textContent = 'Username does not match. Please type your username to confirm.';
        return;
    } else {
        const res = await fetch('/api/delete_group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                group: groupId,
            })
        });
        if (res.ok) {
            document.getElementById('deleteStatus').textContent = 'The group has been deleted.';
        } else if (res.status == 403 || res.status == 400) {
            data = await res.json();
            document.getElementById('deleteStatus').textContent = data.message;
        } else if (res.status == 429) {
            document.getElementById('status').textContent = 'Too many requests! Please wait and try again.';
        } else {
            document.getElementById('deleteStatus').textContent = 'Failed to delete the group.';
        }
    }
}
document.getElementById('backButton').addEventListener('click', () => {
    location.href = '/home';
});
groupId = new URLSearchParams(window.location.search).get('sender');
document.getElementById('addForm').onsubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/add_group_member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById('addInput').value,
            group: groupId,
        })
    })
    if (res.ok) {
        document.getElementById('status').textContent = 'Group member added!';
    } else if (res.status === 413) {
        document.getElementById('status').textContent = 'Username cannot exceed 50 characters.';
    } else if (res.status === 400 || res.status == 403) {
        data = await res.json();
        document.getElementById('status').textContent = data.message;
    } else if (res.status == 429) {
        document.getElementById('status').textContent = 'Too many requests! Please wait and try again.';
    } else {
        document.getElementById('status').textContent = 'Failed to add group member.';
    }
};
document.getElementById('deleteForm').onsubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/remove_group_member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById('deleteInput').value,
            group: groupId,
        })
    })
    if (res.ok) {
        document.getElementById('status').textContent = 'Group member removed!';
    } else if (res.status === 413) {
        document.getElementById('status').textContent = 'Username cannot exceed 50 characters.';
    } else if (res.status === 400 || res.status == 403) {
        data = await res.json();
        document.getElementById('status').textContent = data.message;
    } else if (res.status == 429) {
        document.getElementById('status').textContent = 'Too many requests! Please wait and try again.';
    } else {
        document.getElementById('status').textContent = 'Failed to remove group member.';
    }
};

document.getElementById('renameForm').onsubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/rename_group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: document.getElementById('renameInput').value,
            group: groupId,
        })
    })
    if (res.ok) {
        document.getElementById('renameStatus').textContent = 'Group name changed!';
    } else if (res.status === 413) {
        document.getElementById('renameStatus').textContent = 'Group name must be at least 3 characters and at most 50 characters.';
    } else if (res.status === 400 || res.status == 403) {
        data = await res.json();
        document.getElementById('renameStatus').textContent = data.message;
    } else if (res.status == 429) {
        document.getElementById('renameStatus').textContent = 'Too many requests! Please wait and try again.';
    } else {
    document.getElementById('renameStatus').textContent = 'Failed to change group name.';
    }
};
