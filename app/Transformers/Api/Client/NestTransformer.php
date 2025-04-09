<?php

namespace Pterodactyl\Transformers\Api\Client;

use Pterodactyl\Models\Nest;
use League\Fractal\Resource\Item;
use League\Fractal\Resource\Collection;
use Pterodactyl\Transformers\Api\Application\BaseTransformer;

class NestTransformer extends BaseTransformer
{
    /**
     * Return the resource name for the JSONAPI output.
     */
    public function getResourceName(): string
    {
        return 'nest';
    }

    /**
     * Transform a nest model into a representation that can be shown to regular
     * users of the API.
     */
    public function transform(array $model): array
    {
        return [
            'id' => $model['id'],
            'name' => $model['name'],
            'eggs' => $model['eggs'],
        ];
    }
}