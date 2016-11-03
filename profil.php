<?php
require 'lib/mustache.php-2.11.1/src/Mustache/Autoloader.php';
Mustache_Autoloader::register();

$m = new Mustache_Engine(array(
    'loader' => new Mustache_Loader_FilesystemLoader(dirname(__FILE__) . '/template'),
    'cache' => dirname(__FILE__).'/mustache_cache',
));

$data_json = file_get_contents('scraper/data.json');
$data = json_decode($data_json, true);
$to_send = $data['speakers'][$_GET['id']];
if(is_null($to_send)) {
    $to_send = array(
        'shortName' => 'Chyba',
        'fullName' => 'Chyba :(',
        'speakerDescription' => 'Jejda. Neplatná přednáška. Pokud jste se sem dostali omylem, kontaktujte někoho zodpovědného.'
        );
}

echo $m->render('profil', $to_send);
?>