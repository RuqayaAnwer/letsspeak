<?php
$lines = file('c:\\Users\\MSI\\Desktop\\letspeak\\backend\\storage\\logs\\laravel.log');
$errors = [];
foreach ($lines as $line) {
    if (strpos($line, '.ERROR') !== false && strpos($line, 'T_NS_SEPARATOR') === false) {
        $errors[] = $line;
    }
}
echo implode("\n", array_slice($errors, -10));
