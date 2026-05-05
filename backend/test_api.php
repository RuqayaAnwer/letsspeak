<?php
\ = file_get_contents('http://localhost:8000/api/auth/dev-login', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => json_encode(['email' => 'admin@example.com', 'password' => 'password'])
    ]
]));
\ = json_decode(\)->token;
\ = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Authorization: Bearer \\r\nContent-Type: application/json\r\nAccept: application/json\r\n",
        'content' => json_encode(['note' => 'test', 'type' => 'general']),
        'ignore_errors' => true
    ]
]);
\ = file_get_contents('http://localhost:8000/api/students/1/notes', false, \);
echo \;
