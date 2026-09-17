import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Select,
  Text,
} from '@chakra-ui/react';
import { useLoaderData } from '@remix-run/react';
import { type FC } from 'react';
import { MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import Card from '~/components/card/Card';
import { DevicesCard } from '~/components/settings/DevicesCard';

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

export const Settings: FC = () => {
  const { devices } = useLoaderData<typeof import('~/routes/_admin.settings').loader>();
  const { state, actions } = useSettingsReducer();

  const saveGeneralSection = () => {
    actions.validateHostnameSection((valid) => {
      if (!valid) {
        return;
      }
      console.log('SAVE', state);
    });
  };

  return (
    <Box maxW="760px" display="flex" flexDirection="column" gap="18px">
      <Card p="24px">
        <SectionHeading
          title="General"
          description="Custom hostname for your server — useful with multiple Raspberry Pi devices or a more memorable address."
        />
        <FormControl w={{ base: '100%', md: '60%' }} isInvalid={Boolean(state.isHostNameError)}>
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
        {state.isGeneralSectionDirty ? (
          <Button variant="brand" mt="16px" onClick={saveGeneralSection}>
            Save
          </Button>
        ) : null}
      </Card>

      <Card p="24px">
        <SectionHeading
          title="Access Point"
          description="Broadcasts the network for your Picobrew devices to connect to."
        />
        <Box display="flex" flexDirection="column" gap="14px" w={{ base: '100%', md: '60%' }}>
          <FormControl>
            <FieldLabel>AP Network Name</FieldLabel>
            <Input
              name="ap-name"
              isRequired
              placeholder="AP Network Name"
              value={state.apNetworkName}
              onChange={(event) => actions.setApNetworkName(event.target.value)}
            />
          </FormControl>
          <FormControl>
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
                  _hover={{ cursor: 'pointer' }}
                  as={state.showAPPassword ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                  onClick={() => actions.setShowAPPassword(!state.showAPPassword)}
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>
        </Box>
        <Text fontSize="12px" color="ink.textFaintest" mt="12px">
          Managed by Pi setup scripts. Changes here are for display only.
        </Text>
        {state.isAPSectionDirty ? (
          <Button mt="12px" isDisabled>
            Save
          </Button>
        ) : null}
      </Card>

      <Card p="24px">
        <SectionHeading
          title="Wi-Fi"
          description="Upstream network connecting the Raspberry Pi to your router and the internet."
        />
        <Box display="flex" flexDirection="column" gap="14px" w={{ base: '100%', md: '60%' }}>
          <FormControl>
            <FieldLabel>Network Name</FieldLabel>
            <Select
              placeholder="Select a network"
              value={state.wifiNetworkName}
              onChange={(event) => actions.setWifiNetworkName(event.target.value)}
            >
              <option value="option1">Option 1</option>
              <option value="option2">Option 2</option>
              <option value="option3">Option 3</option>
            </Select>
          </FormControl>
          <FormControl>
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
                  _hover={{ cursor: 'pointer' }}
                  as={state.showWifiPassword ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                  onClick={() => actions.setShowWifiPassword(!state.showWifiPassword)}
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>
        </Box>
        <Text fontSize="12px" color="ink.textFaintest" mt="12px">
          Managed by Pi system configuration. Changes here are for display only.
        </Text>
        {state.isWifiSectionDirty ? (
          <Button mt="12px" isDisabled>
            Save
          </Button>
        ) : null}
      </Card>

      <DevicesCard devices={devices} />
    </Box>
  );
};
