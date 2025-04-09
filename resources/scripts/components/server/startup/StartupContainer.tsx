import React, { useCallback, useEffect, useState } from 'react';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import tw from 'twin.macro';
import VariableBox from '@/components/server/startup/VariableBox';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import getServerStartup from '@/api/swr/getServerStartup';
import Spinner from '@/components/elements/Spinner';
import { ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import { ServerContext } from '@/state/server';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';
import Select from '@/components/elements/Select';
import isEqual from 'react-fast-compare';
import Input from '@/components/elements/Input';
import setSelectedDockerImage from '@/api/server/setSelectedDockerImage';
import InputSpinner from '@/components/elements/InputSpinner';
import useFlash from '@/plugins/useFlash';
import http from '@/api/http';
import Button from '@/components/elements/Button';

const StartupContainer = () => {
    const [loading, setLoading] = useState(false);
    const [nestLoading, setNestLoading] = useState(false);
    const [eggLoading, setEggLoading] = useState(false);
    const [startupLoading, setStartupLoading] = useState(false);
    const [nests, setNests] = useState<Array<{ id: number; name: string; eggs: Array<{ id: number; name: string }> }>>([]);
    const [selectedNestId, setSelectedNestId] = useState<number | null>(null);
    const [selectedEggId, setSelectedEggId] = useState<number | null>(null);
    const [startupCommand, setStartupCommand] = useState<string>('');
    const [skipScripts, setSkipScripts] = useState<boolean>(false);
    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const variables = ServerContext.useStoreState(
        ({ server }) => ({
            variables: server.data!.variables,
            invocation: server.data!.invocation,
            dockerImage: server.data!.dockerImage,
        }),
        isEqual
    );

    const { data, error, isValidating, mutate } = getServerStartup(uuid, {
        ...variables,
        dockerImages: { [variables.dockerImage]: variables.dockerImage },
    });

    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);
    const isCustomImage =
        data &&
        !Object.values(data.dockerImages)
            .map((v) => v.toLowerCase())
            .includes(variables.dockerImage.toLowerCase());

    useEffect(() => {
        // Since we're passing in initial data this will not trigger on mount automatically. We
        // want to always fetch fresh information from the API however when we're loading the startup
        // information.
        mutate();

        // Fetch nests and eggs
        setNestLoading(true);
        http.get('/api/client/nests')
            .then(({ data }) => {
                setNests(data.data);
                // Get current nest and egg for the server
                http.get(`/api/client/servers/${uuid}/startup/details`)
                    .then(({ data }) => {
                        setSelectedNestId(data.nest_id);
                        setSelectedEggId(data.egg_id);
                        setStartupCommand(data.startup);
                        setSkipScripts(data.skip_scripts);
                    })
                    .catch(error => {
                        console.error(error);
                        clearAndAddHttpError({ key: 'startup:details', error });
                    })
                    .finally(() => setNestLoading(false));
            })
            .catch(error => {
                console.error(error);
                clearAndAddHttpError({ key: 'startup:nests', error });
                setNestLoading(false);
            });
    }, []);

    useDeepCompareEffect(() => {
        if (!data) return;

        setServerFromState((s) => ({
            ...s,
            invocation: data.invocation,
            variables: data.variables,
        }));
    }, [data]);

    const updateSelectedDockerImage = useCallback(
        (v: React.ChangeEvent<HTMLSelectElement>) => {
            setLoading(true);
            clearFlashes('startup:image');

            const image = v.currentTarget.value;
            setSelectedDockerImage(uuid, image)
                .then(() => setServerFromState((s) => ({ ...s, dockerImage: image })))
                .catch((error) => {
                    console.error(error);
                    clearAndAddHttpError({ key: 'startup:image', error });
                })
                .then(() => setLoading(false));
        },
        [uuid]
    );
    
    const updateNest = useCallback((v: React.ChangeEvent<HTMLSelectElement>) => {
        const nestId = parseInt(v.currentTarget.value);
        setSelectedNestId(nestId);
        setSelectedEggId(null);
    }, []);
    
    const updateEgg = useCallback((v: React.ChangeEvent<HTMLSelectElement>) => {
        const eggId = parseInt(v.currentTarget.value);
        setSelectedEggId(eggId);
    }, []);
    
    const saveStartupChanges = useCallback(() => {
        if (!selectedNestId || !selectedEggId) {
            addFlash({
                key: 'startup:save',
                type: 'error',
                title: 'Error',
                message: 'You must select both a nest and an egg.',
            });
            return;
        }
        
        setStartupLoading(true);
        clearFlashes('startup:save');
        
        http.post(`/api/client/servers/${uuid}/startup/update`, {
            nest_id: selectedNestId,
            egg_id: selectedEggId,
            startup: startupCommand,
            skip_scripts: skipScripts,
        })
            .then(() => {
                addFlash({
                    key: 'startup:save',
                    type: 'success',
                    title: 'Success',
                    message: 'Server startup settings have been updated successfully.',
                });
                // Refresh the page to get updated variables
                window.location.reload();
            })
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ key: 'startup:save', error });
            })
            .finally(() => setStartupLoading(false));
    }, [uuid, selectedNestId, selectedEggId, startupCommand, skipScripts]);

    return !data ? (
        !error || (error && isValidating) ? (
            <Spinner centered size={Spinner.Size.LARGE} />
        ) : (
            <ServerError title={'Oops!'} message={httpErrorToHuman(error)} onRetry={() => mutate()} />
        )
    ) : (
        <ServerContentBlock title={'Startup Settings'} showFlashKey={'startup:image'}>
            <div css={tw`md:flex`}>
                <TitledGreyBox title={'Startup Command'} css={tw`flex-1`}>
                    <div css={tw`px-1 py-2`}>
                        <p css={tw`font-mono bg-neutral-900 rounded py-2 px-4 mb-2`}>{data.invocation}</p>
                        <Input
                            value={startupCommand}
                            onChange={e => setStartupCommand(e.target.value)}
                            placeholder="Edit startup command"
                        />
                        <p css={tw`text-xs text-neutral-300 mt-2`}>
                            Edit your server's startup command here. The following variables are available by default: <code>@{{SERVER_MEMORY}}</code>, <code>@{{SERVER_IP}}</code>, and <code>@{{SERVER_PORT}}</code>.
                        </p>
                    </div>
                </TitledGreyBox>
                <TitledGreyBox title={'Docker Image'} css={tw`flex-1 lg:flex-none lg:w-1/3 mt-8 md:mt-0 md:ml-10`}>
                    {Object.keys(data.dockerImages).length > 1 && !isCustomImage ? (
                        <>
                            <InputSpinner visible={loading}>
                                <Select
                                    disabled={Object.keys(data.dockerImages).length < 2}
                                    onChange={updateSelectedDockerImage}
                                    defaultValue={variables.dockerImage}
                                >
                                    {Object.keys(data.dockerImages).map((key) => (
                                        <option key={data.dockerImages[key]} value={data.dockerImages[key]}>
                                            {key}
                                        </option>
                                    ))}
                                </Select>
                            </InputSpinner>
                            <p css={tw`text-xs text-neutral-300 mt-2`}>
                                This is an advanced feature allowing you to select a Docker image to use when running
                                this server instance.
                            </p>
                        </>
                    ) : (
                        <>
                            <Input disabled readOnly value={variables.dockerImage} />
                            {isCustomImage && (
                                <p css={tw`text-xs text-neutral-300 mt-2`}>
                                    This {"server's"} Docker image has been manually set by an administrator and cannot
                                    be changed through this UI.
                                </p>
                            )}
                        </>
                    )}
                </TitledGreyBox>
            </div>
            
            <div css={tw`md:flex mt-8`}>
                <TitledGreyBox title={'Service Configuration'} css={tw`flex-1 mr-0 md:mr-4`}>
                    <div css={tw`px-1 py-2`}>
                        <p css={tw`text-sm text-red-500 mb-4`}>
                            Changing any of the below values will result in the server processing a re-install command. The server will be stopped and will then proceed.
                            If you would like the service scripts to not run, ensure the box is checked at the bottom.
                        </p>
                        <p css={tw`text-sm text-red-500 mb-4`}>
                            <strong>This is a destructive operation in many cases. This server will be stopped immediately in order for this action to proceed.</strong>
                        </p>
                        
                        <div css={tw`mb-4`}>
                            <label htmlFor="pNestId" css={tw`text-sm text-neutral-300 block mb-1`}>Nest</label>
                            <InputSpinner visible={nestLoading}>
                                <Select
                                    id="pNestId"
                                    onChange={updateNest}
                                    value={selectedNestId?.toString() || ''}
                                >
                                    {nests.map((nest) => (
                                        <option key={nest.id} value={nest.id.toString()}>
                                            {nest.name}
                                        </option>
                                    ))}
                                </Select>
                            </InputSpinner>
                            <p css={tw`text-xs text-neutral-300 mt-1`}>Select the Nest that this server will be grouped into.</p>
                        </div>
                        
                        <div css={tw`mb-4`}>
                            <label htmlFor="pEggId" css={tw`text-sm text-neutral-300 block mb-1`}>Egg</label>
                            <InputSpinner visible={eggLoading}>
                                <Select
                                    id="pEggId"
                                    onChange={updateEgg}
                                    value={selectedEggId?.toString() || ''}
                                    disabled={!selectedNestId}
                                >
                                    {selectedNestId && nests
                                        .find(n => n.id === selectedNestId)?.eggs
                                        .map((egg) => (
                                            <option key={egg.id} value={egg.id.toString()}>
                                                {egg.name}
                                            </option>
                                        ))}
                                </Select>
                            </InputSpinner>
                            <p css={tw`text-xs text-neutral-300 mt-1`}>Select the Egg that will provide processing data for this server.</p>
                        </div>
                        
                        <div css={tw`mb-4`}>
                            <div css={tw`flex items-center`}>
                                <input 
                                    id="pSkipScripting" 
                                    type="checkbox" 
                                    checked={skipScripts} 
                                    onChange={e => setSkipScripts(e.target.checked)}
                                    css={tw`mr-2`}
                                />
                                <label htmlFor="pSkipScripting" css={tw`text-sm text-neutral-300 font-semibold`}>Skip Egg Install Script</label>
                            </div>
                            <p css={tw`text-xs text-neutral-300 mt-1`}>If the selected Egg has an install script attached to it, the script will run during install. If you would like to skip this step, check this box.</p>
                        </div>
                        
                        <div css={tw`mt-6`}>
                            <Button 
                                css={tw`w-full`} 
                                onClick={saveStartupChanges} 
                                disabled={startupLoading}
                                isLoading={startupLoading}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </TitledGreyBox>
            </div>
            
            <h3 css={tw`mt-8 mb-2 text-2xl`}>Variables</h3>
            <div css={tw`grid gap-8 md:grid-cols-2`}>
                {data.variables.map((variable) => (
                    <VariableBox key={variable.envVariable} variable={variable} />
                ))}
            </div>
        </ServerContentBlock>
    );
};

export default StartupContainer;
