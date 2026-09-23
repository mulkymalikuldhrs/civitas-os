<?php
// Build CivitasBridge.phar dari folder plugin (untuk PocketMine-MP 5)
$dir = __DIR__ . '/plugins/CivitasBridge';
$pharPath = __DIR__ . '/plugins/CivitasBridge.phar';
if (file_exists($pharPath)) { @unlink($pharPath); }
$phar = new Phar($pharPath);
$phar->buildFromDirectory($dir);
$phar->setStub('<?php __HALT_COMPILER();');
echo "BUILT: $pharPath (" . filesize($pharPath) . " bytes)\n";
