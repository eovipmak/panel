<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Repositories\Eloquent\NestRepository;
use Pterodactyl\Transformers\Api\Client\NestTransformer;

class NestController extends ClientApiController
{
    /**
     * NestController constructor.
     */
    public function __construct(private NestRepository $nestRepository)
    {
        parent::__construct();
    }

    /**
     * Get all nests and their associated eggs that a user can access.
     */
    public function index(): array
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
        
        return $this->fractal->collection($data)
            ->transformWith($this->getTransformer(NestTransformer::class))
            ->toArray();
    }
}