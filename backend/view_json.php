<?php
$data = json_decode(file_get_contents("forms.json"), true);
foreach($data as $item) {
    if(isset($item["type"]) && $item["type"] === "table") {
        print_r(array_slice($item["data"], 0, 1));
        break;
    }
}
