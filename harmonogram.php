<?php
require 'lib/mustache.php-2.11.1/src/Mustache/Autoloader.php';
Mustache_Autoloader::register();

$m = new Mustache_Engine(array(
    'loader' => new Mustache_Loader_FilesystemLoader(dirname(__FILE__) . '/template'),
    'cache' => dirname(__FILE__).'/mustache_cache',
));

$data_json = file_get_contents('scraper/data.json');
$data = json_decode($data_json, true);

echo $m->render('list', $data);
?>