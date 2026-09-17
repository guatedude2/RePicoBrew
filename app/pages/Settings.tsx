import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react';
import { useFetcher, useLoaderData } from 'react-router';
import { useEffect, useRef, type FC } from 'react';
import { MdInfoOutline, MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import Card from '~/components/card/Card';
import { DevicesCard } from '~/components/settings/DevicesCard';
import { UsersCard } from '~/components/settings/UsersCard';

import type { SaveState } from './Settings/settings-reducer';
import { useSettingsReducer } from './Settings/settings-reducer';

const SectionHeading: FC<{ title: string; description: string }> = ({ title, description }) => (
  <>
    <Text fontSize="17px" fontWeight="700">
      {title}
    </Text>
    <Text fontSize="13px" color="ink.textDim" my="8px" lineHeight="1.5">
      {description}
    </Text>
  </>
);

const FieldLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <FormLabel fontSize="12px" fontWeight="600" color="ink.textSecondary" mb="6px">
    {children}
  </FormLabel>
);

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Save Changes',
  saving: 'Saving…',
  restarting: 'Restarting device…',
};

const SaveButton: FC<{ saveState: SaveState; onClick: () => void; isDisabled?: boolean }> = ({
  saveState,
  onClick,
  isDisabled,
}) => (
  <Button
    variant="brand"
    mt="16px"
    alignSelf="flex-start"
    isLoading={saveState !== 'idle'}
    isDisabled={isDisabled}
    onClick={onClick}
  >
    {SAVE_LABEL[saveState]}
  </Button>
);

const RpiOnlyNotice: FC = () => (
  <Flex
    align="center"
    gap="8px"
    bg="info.100"
    color="info.500"
    border="1px solid"
    borderColor="info.500"
    borderRadius="8px"
    px="14px"
    py="10px"
    fontSize="13px"
    fontWeight="600"
    mb="16px"
  >
    <Icon as={MdInfoOutline} boxSize="16px" />
    These are Raspberry Pi settings. This server isn&apos;t running on a Raspberry Pi, so they&apos;re read-only here.
  </Flex>
);

// Restarting a Pi's network services after a config change takes a few seconds — this simulates
// that wait client-side once the save itself succeeds, matching the design's saving -> restarting
// -> idle sequence. The actual hostapd/wpa_supplicant/hostname restart isn't wired up yet; that's
// infrastructure-specific and belongs behind the corresponding Pi-side service call.
const RESTART_DELAY_MS = 2200;

export const Settings: FC = () => {
  const { devices, discoveredDevices, users, hostname, accessPoint, wifi, isRpi } =
    useLoaderData<typeof import('~/routes/_admin.settings').loader>();
  const { state, actions, dispatch } = useSettingsReducer();
  // Bypasses a generics-inference quirk in the shared tiny-reducer helper that collapses these
  // three action creators' payload type to `never` when mixed with the larger reducer map; the
  // runtime behavior is identical to calling actions.setXSaveState(...) directly.
  const setGeneralSaveState = (payload: SaveState) => dispatch({ type: 'setGeneralSaveState', payload });
  const setApSaveState = (payload: SaveState) => dispatch({ type: 'setApSaveState', payload });
  const setWifiSaveState = (payload: SaveState) => dispatch({ type: 'setWifiSaveState', payload });

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) {
      return;
    }
    hydrated.current = true;
    actions.hydrate({
      hostName: hostname,
      apNetworkName: accessPoint.name,
      apPassword: accessPoint.password,
      wifiNetworkName: wifi.name,
      wifiPassword: wifi.password,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generalFetcher = useFetcher();
  const apFetcher = useFetcher();
  const wifiFetcher = useFetcher();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runSave = (fetcher: any, setSaveState: (s: SaveState) => void, body: Record<string, string>) => {
    setSaveState('saving');
    fetcher.submit(body, { method: 'post' });
  };

  useEffect(() => {
    if (generalFetcher.state !== 'idle' || !generalFetcher.data) {
      return;
    }
    if (state.generalSaveState !== 'saving') {
      return;
    }
    setGeneralSaveState('restarting');
    const t = setTimeout(() => setGeneralSaveState('idle'), RESTART_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalFetcher.state, generalFetcher.data]);

  useEffect(() => {
    if (apFetcher.state !== 'idle' || !apFetcher.data) {
      return;
    }
    if (state.apSaveState !== 'saving') {
      return;
    }
    setApSaveState('restarting');
    const t = setTimeout(() => setApSaveState('idle'), RESTART_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apFetcher.state, apFetcher.data]);

  useEffect(() => {
    if (wifiFetcher.state !== 'idle' || !wifiFetcher.data) {
      return;
    }
    if (state.wifiSaveState !== 'saving') {
      return;
    }
    setWifiSaveState('restarting');
    const t = setTimeout(() => setWifiSaveState('idle'), RESTART_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wifiFetcher.state, wifiFetcher.data]);

  const saveGeneralSection = () => {
    actions.validateHostnameSection((valid) => {
      if (!valid) {
        return;
      }
      runSave(generalFetcher, setGeneralSaveState, { intent: 'saveGeneral', hostname: state.hostName });
    });
  };

  const saveAccessPoint = () =>
    runSave(apFetcher, setApSaveState, {
      intent: 'saveAccessPoint',
      name: state.apNetworkName,
      password: state.apPassword,
    });

  const saveWifi = () =>
    runSave(wifiFetcher, setWifiSaveState, {
      intent: 'saveWifi',
      name: state.wifiNetworkName,
      password: state.wifiPassword,
    });

  return (
    <Box maxW="760px" display="flex" flexDirection="column" gap="18px">
      <Tabs colorScheme="brand">
        <TabList>
          <Tab>General</Tab>
          <Tab>Access Point</Tab>
          <Tab>Wi-Fi</Tab>
          <Tab>Users</Tab>
          <Tab>Devices</Tab>
        </TabList>

        <TabPanels>
          <TabPanel px="0">
            <Card p="24px" display="flex" flexDirection="column">
              <SectionHeading
                title="General"
                description="Custom hostname for your server — useful with multiple Raspberry Pi devices or a more memorable address."
              />
              {!isRpi && <RpiOnlyNotice />}
              <FormControl
                w={{ base: '100%', md: '60%' }}
                isInvalid={Boolean(state.isHostNameError)}
                isDisabled={!isRpi}
              >
                <FieldLabel>Hostname</FieldLabel>
                <Input
                  name="hostname"
                  isRequired
                  placeholder="Hostname"
                  value={state.hostName}
                  onKeyDown={(event) => (/[^\w.\-_]/.test(event.key) ? event.preventDefault() : null)}
                  onChange={(event) => actions.setHostName(event.target.value)}
                />
                {state.isHostNameError ? <FormErrorMessage>{state.isHostNameError}</FormErrorMessage> : null}
              </FormControl>
              <SaveButton saveState={state.generalSaveState} onClick={saveGeneralSection} isDisabled={!isRpi} />
            </Card>
          </TabPanel>

          <TabPanel px="0">
            <Card p="24px" display="flex" flexDirection="column">
              <SectionHeading
                title="Access Point"
                description="Broadcasts the network for your Picobrew devices to connect to."
              />
              {!isRpi && <RpiOnlyNotice />}
              <Box display="flex" flexDirection="column" gap="14px" w={{ base: '100%', md: '60%' }}>
                <FormControl isDisabled={!isRpi}>
                  <FieldLabel>AP Network Name</FieldLabel>
                  <Input
                    name="ap-name"
                    isRequired
                    placeholder="AP Network Name"
                    value={state.apNetworkName}
                    onChange={(event) => actions.setApNetworkName(event.target.value)}
                  />
                </FormControl>
                <FormControl isDisabled={!isRpi}>
                  <FieldLabel>Password (WPA2)</FieldLabel>
                  <InputGroup>
                    <Input
                      name="ap-password"
                      isRequired
                      placeholder="Password"
                      type={state.showAPPassword ? 'text' : 'password'}
                      value={state.apPassword}
                      onChange={(event) => actions.setApPassword(event.target.value)}
                    />
                    <InputRightElement>
                      <Icon
                        color="ink.textFaint"
                        opacity={isRpi ? 1 : 0.4}
                        pointerEvents={isRpi ? 'auto' : 'none'}
                        _hover={{ cursor: 'pointer' }}
                        as={state.showAPPassword ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                        onClick={() => actions.setShowAPPassword(!state.showAPPassword)}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
              </Box>
              <SaveButton saveState={state.apSaveState} onClick={saveAccessPoint} isDisabled={!isRpi} />
            </Card>
          </TabPanel>

          <TabPanel px="0">
            <Card p="24px" display="flex" flexDirection="column">
              <SectionHeading
                title="Wi-Fi"
                description="Upstream network connecting the Raspberry Pi to your router and the internet."
              />
              {!isRpi && <RpiOnlyNotice />}
              <Box display="flex" flexDirection="column" gap="14px" w={{ base: '100%', md: '60%' }}>
                <FormControl isDisabled={!isRpi}>
                  <FieldLabel>Network Name</FieldLabel>
                  <Input
                    name="wifi-name"
                    isRequired
                    placeholder="Network Name"
                    value={state.wifiNetworkName}
                    onChange={(event) => actions.setWifiNetworkName(event.target.value)}
                  />
                </FormControl>
                <FormControl isDisabled={!isRpi}>
                  <FieldLabel>Password (WPA2)</FieldLabel>
                  <InputGroup>
                    <Input
                      name="wifi-password"
                      isRequired
                      placeholder="Password"
                      type={state.showWifiPassword ? 'text' : 'password'}
                      value={state.wifiPassword}
                      onChange={(event) => actions.setWifiPassword(event.target.value)}
                    />
                    <InputRightElement>
                      <Icon
                        color="ink.textFaint"
                        opacity={isRpi ? 1 : 0.4}
                        pointerEvents={isRpi ? 'auto' : 'none'}
                        _hover={{ cursor: 'pointer' }}
                        as={state.showWifiPassword ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                        onClick={() => actions.setShowWifiPassword(!state.showWifiPassword)}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
              </Box>
              <SaveButton saveState={state.wifiSaveState} onClick={saveWifi} isDisabled={!isRpi} />
            </Card>
          </TabPanel>

          <TabPanel px="0">
            <UsersCard users={users} />
          </TabPanel>

          <TabPanel px="0">
            <DevicesCard devices={devices} discoveredDevices={discoveredDevices} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};
