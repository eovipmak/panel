<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Repositories\Eloquent\NestRepository;
use Pterodactyl\Repositories\Eloquent\NodeRepository;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Pterodactyl\Services\Servers\StartupModificationService;
use Pterodactyl\Transformers\Api\Client\EggVariableTransformer;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Services\Servers\EnvironmentService;
use Pterodactyl\Models\User;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

class StartupDetailsController extends ClientApiController
{
    /**
     * StartupDetailsController constructor.
     */
    public function __construct(
        private NestRepository $nestRepository,
        private NodeRepository $nodeRepository,
        private StartupModificationService $startupModificationService,
        private EnvironmentService $environmentService
    ) {
        parent::__construct();
    }

    /**
     * Get the startup details for a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        return new JsonResponse([
            'nest_id' => $server->nest_id,
            'egg_id' => $server->egg_id,
            'startup' => $server->startup,
            'skip_scripts' => $server->skip_scripts,
        ]);
    }

    /**
     * Get all available nests and eggs for the user.
     */
    public function nests(Request $request): JsonResponse
    {
        $nests = $this->nestRepository->getWithEggs();
        
        $data = [];
        foreach ($nests as $nest) {
            $eggs = [];
            foreach ($nest->eggs as $egg) {
                $eggs[] = [
                    'id' => $egg->id,
                    'name' => $egg->name,
                ];
            }
            
            $data[] = [
                'id' => $nest->id,
                'name' => $nest->name,
                'eggs' => $eggs,
            ];
        }
        
        return new JsonResponse(['data' => $data]);
    }

    /**
     * Update the startup settings for a server.
     * 
     * @throws \Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException
     * @throws \Pterodactyl\Exceptions\Model\DataValidationException
     * @throws \Pterodactyl\Exceptions\Repository\RecordNotFoundException
     */
    public function update(Request $request, Server $server): JsonResponse
    {
        $validated = $request->validate([
            'nest_id' => 'required|numeric|exists:nests,id',
            'egg_id' => 'required|numeric|exists:eggs,id',
            'startup' => 'required|string',
            'skip_scripts' => 'sometimes|boolean',
        ]);
        
        $server = $this->startupModificationService
            ->setUserLevel(User::USER_LEVEL_USER)
            ->handle($server, $validated);
            
        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }
}