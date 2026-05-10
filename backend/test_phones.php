<?php
$data = json_decode(file_get_contents("data.json"), true);
$forms = json_decode(file_get_contents("forms.json"), true);
echo "Data.json first phone: " . ($data[0]["data"][0]["WhatsApp_Number"] ?? $data[0]["data"][0]["whatsapp"] ?? "N/A") . "\n";
echo "Forms.json first phone: " . ($forms[0]["whatsapp"] ?? "N/A") . "\n";

