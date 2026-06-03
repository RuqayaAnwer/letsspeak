<?php
$data = json_decode(file_get_contents('data.json'), true);
$keys = [];
foreach($data as $r) {
    foreach(array_keys($r) as $k) {
        $keys[$k] = 1;
    }
}
print_r(array_keys($keys));
