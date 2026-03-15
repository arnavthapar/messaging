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

document.getElementById('groupForm').onsubmit = async (e) => {
    e.preventDefault();
    // Get the clicked submit button
    const submitter = e.submitter;
    const action = submitter?.value;
    if (action !== 'send') {
        return;
    }
    sender = await loadUsername();
    if ([...document.querySelectorAll('[id^="groupMember"]')].some(el => el.value == sender)) {
        document.getElementById('status').textContent = 'You cannot add yourself to the group. (You will already be in it)';
        return;
    }
    const res = await fetch('/api/create_group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: document.getElementById('groupName').value,
            members: [
                document.getElementById('groupMember1').value,
                document.getElementById('groupMember2').value,
                document.getElementById('groupMember3').value,
                document.getElementById('groupMember4').value,
                document.getElementById('groupMember5').value,
                document.getElementById('groupMember6').value,
                document.getElementById('groupMember7').value,
                document.getElementById('groupMember8').value,
                document.getElementById('groupMember9').value
            ],
            message: document.getElementById('groupMessage').value
        })
    });
    if (res.ok) {
        document.getElementById('status').textContent = 'Group created!';
    } else if (res.status === 413) {
        document.getElementById('status').textContent = 'Message cannot exceed 4000 characters.';
    } else if (res.status === 400) {
        data = await res.json();
        document.getElementById('status').textContent = data.message;
    } else {
        document.getElementById('status').textContent = 'Failed to create group.';
    }
};
