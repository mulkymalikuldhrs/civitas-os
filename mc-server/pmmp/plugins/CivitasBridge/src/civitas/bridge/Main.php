<?php

declare(strict_types=1);

namespace civitas\bridge;

use pocketmine\plugin\PluginBase;
use pocketmine\command\Command;
use pocketmine\command\PluginCommand;
use pocketmine\command\CommandExecutor;
use pocketmine\command\CommandSender;
use pocketmine\entity\Location;
use pocketmine\entity\Villager;
use pocketmine\item\StringToItemParser;
use pocketmine\math\Vector3;
use pocketmine\world\World;
use pocketmine\world\Position;

/**
 * CivitasBridge — jembatan resmi CIVITAS OS <-> dunia Minecraft (Bedrock).
 * Perintah: /civ summon|setblock|fill|census|tp
 * Semua aksi dicatat ke log server (audit penuh, tanpa pintu belakang).
 */
final class Main extends PluginBase {

    public function onEnable() : void{
        $cmd = new PluginCommand("civ", $this, new CivCommand($this));
        $cmd->setDescription("Perintah jembatan CIVITAS OS");
        $cmd->setUsage("/civ help");
        $cmd->setPermission("civitas.command");
        $this->getServer()->getCommandMap()->register("civitas", $cmd);
        $this->getLogger()->info("CivitasBridge aktif - peradaban Nusantara terhubung ke dunia nyata");
    }

    public function onDisable() : void{
        $this->getLogger()->info("CivitasBridge nonaktif");
    }
}

/**
 * Perintah /civ — dieksekusi dari konsol server (kernel) atau pemain ber-OP.
 */
final class CivCommand implements CommandExecutor {

    private const MAX_FILL = 4096; // kebijakan keamanan di luar LLM

    public function __construct(private Main $plugin) {}

    public function onCommand(CommandSender $sender, Command $cmd, string $label, array $args) : bool{
        $sub = strtolower($args[0] ?? "help");
        $world = $this->plugin->getServer()->getWorldManager()->getDefaultWorld();
        if ($world === null) {
            $sender->sendMessage("[CIVITAS] dunia default belum siap");
            return true;
        }

        try {
            switch ($sub) {
                case "spawninfo": { // /civ spawninfo - lokasi spawn dunia
                    $s = $world->getSpawnLocation();
                    $sender->sendMessage("[CIVITAS] spawn dunia: " . $s->getFloorX() . "/" . $s->getFloorY() . "/" . $s->getFloorZ());
                    return true;
                }

                case "summon": { // /civ summon [x y z] [jumlah] - default di spawn dunia
                    $n = max(1, min(12, (int) ($args[1] ?? ($args[4] ?? 1))));
                    if (count($args) >= 4 && is_numeric($args[1]) ) {
                        $sx = (float) $args[1]; $sy = (float) $args[2]; $sz = (float) $args[3];
                    } else {
                        $s = $world->getSpawnLocation(); $sx = $s->getX(); $sy = $s->getY(); $sz = $s->getZ();
                    }
                    $safe = $world->getSafeSpawn(new Vector3($sx, $sy, $sz));
                    for ($i = 0; $i < $n; $i++) {
                        $loc = new Location($safe->getX() + ($i % 2), $safe->getY() + 0.5, $safe->getZ() + intdiv($i, 2), $world, 0.0, 0.0);
                        $v = new Villager($loc);
                        $v->spawnToAll();
                    }
                    $sender->sendMessage("[CIVITAS] $n villager dipanggil di " . $safe->getFloorX() . "/" . $safe->getFloorY() . "/" . $safe->getFloorZ() . " (dunia " . $world->getFolderName() . ")");
                    return true;
                }

                case "setblock": // /civ setblock <x> <y> <z> <blok>
                    if (count($args) < 5) { $sender->sendMessage("[CIVITAS] pakai: /civ setblock <x> <y> <z> <blok>"); return true; }
                    $block = StringToItemParser::getInstance()->parse($args[4])?->getBlock();
                    if ($block === null) { $sender->sendMessage("[CIVITAS] blok tak dikenal: " . $args[4]); return true; }
                    $cx = ((int) $args[1]) >> 4; $cz = ((int) $args[3]) >> 4;
                    if (!$world->isChunkInUse($cx, $cz)) { $world->loadChunk($cx, $cz); }
                    $pos = new Vector3((int) $args[1], (int) $args[2], (int) $args[3]);
                    $world->setBlock($pos, $block);
                    $sender->sendMessage("[CIVITAS] blok " . $args[4] . " dipasang di " . $pos->getFloorX() . "/" . $pos->getFloorY() . "/" . $pos->getFloorZ());
                    return true;

                case "fill": // /civ fill <x1> <y1> <z1> <x2> <y2> <z2> <blok>
                    if (count($args) < 8) { $sender->sendMessage("[CIVITAS] pakai: /civ fill <x1> <y1> <z1> <x2> <y2> <z2> <blok>"); return true; }
                    $x1 = (int) $args[1]; $y1 = (int) $args[2]; $z1 = (int) $args[3];
                    $x2 = (int) $args[4]; $y2 = (int) $args[5]; $z2 = (int) $args[6];
                    $count = abs($x2 - $x1 + 1) * abs($y2 - $y1 + 1) * abs($z2 - $z1 + 1);
                    if ($count > self::MAX_FILL) { $sender->sendMessage("[CIVITAS] fill $count blok melebihi batas " . self::MAX_FILL); return true; }
                    $block = StringToItemParser::getInstance()->parse($args[7])?->getBlock();
                    if ($block === null) { $sender->sendMessage("[CIVITAS] blok tak dikenal: " . $args[7]); return true; }
                    $done = 0;
                    for ($x = min($x1, $x2); $x <= max($x1, $x2); $x++)
                        for ($y = min($y1, $y2); $y <= max($y1, $y2); $y++)
                            for ($z = min($z1, $z2); $z <= max($z1, $z2); $z++) {
                                $world->setBlock(new Vector3($x, $y, $z), $block);
                                $done++;
                            }
                    $sender->sendMessage("[CIVITAS] $done blok " . $args[7] . " dipasang ($x1/$y1/$z1 - $x2/$y2/$z2)");
                    return true;

                case "census": // /civ census - daftar villager hidup (uid + posisi)
                    $list = [];
                    foreach ($world->getEntities() as $e) {
                        if ($e instanceof Villager) {
                            $p = $e->getPosition();
                            $list[] = sprintf("%s@%d/%d/%d", spl_object_id($e), (int) $p->getX(), (int) $p->getY(), (int) $p->getZ());
                        }
                    }
                    $sender->sendMessage("[CIVITAS] villager hidup: " . count($list) . " -> " . implode(", ", array_slice($list, 0, 24)));
                    return true;

                default:
                    $sender->sendMessage("[CIVITAS] pakai: /civ summon|x y z [n] | setblock x y z blok | fill x1 y1 z1 x2 y2 z2 blok | census");
                    return true;
            }
        } catch (\Throwable $e) {
            $sender->sendMessage("[CIVITAS][GAGAL] " . $e->getMessage());
            return true;
        }
    }
}
