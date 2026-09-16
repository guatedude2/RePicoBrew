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
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Card alignItems="center" flexDirection="column" w="100%" mb={4}>
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <Text me="auto" fontSize="xl" fontWeight="700" lineHeight="100%">
            General
          </Text>
          <Text my={4}>
            If you want to have a custom hostname for your server you can customize this below. This is useful if you
            have multiple Raspberry PI devices and/or want to have a more memorable or meaningful hostname for your
            configuration.
          </Text>

          <FormControl w="50%" mb={3} isInvalid={Boolean(state.isHostNameError)}>
            <FormLabel ms="4px" fontWeight="500" display="flex">
              Hostname<Text color="brand.500">*</Text>
            </FormLabel>
            <Input
              name="hostname"
              isRequired
              placeholder="Hostname"
              value={state.hostName}
              onKeyDown={(event) => (/[^\w.\-_]/.test(event.key) ? event.preventDefault() : null)}
              onChange={(event) => actions.setHostName(event.target.value)}
            />
            {state.isHostNameError ? <FormErrorMessage ms="4px">{state.isHostNameError}</FormErrorMessage> : null}
          </FormControl>
          {state.isGeneralSectionDirty ? <Button onClick={saveGeneralSection}>Save</Button> : null}
        </Flex>
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <Text me="auto" fontSize="xl" fontWeight="700" lineHeight="100%">
            Access Point
          </Text>
          <Text my={4}>
            This access point is used to broadcast the network for your Picobrew devices to connect to.
          </Text>

          <FormControl w="50%">
            <FormLabel ms="4px" fontWeight="500" display="flex">
              AP Network Name<Text color="brand.500">*</Text>
            </FormLabel>
            <Input
              name="ap-name"
              isRequired
              placeholder="AP Network Name"
              mb={3}
              value={state.apNetworkName}
              onChange={(event) => actions.setApNetworkName(event.target.value)}
            />
          </FormControl>
          <FormControl w="50%">
            <FormLabel ms="4px" fontWeight="500" display="flex">
              Password (WPA2)<Text color="brand.500">*</Text>
            </FormLabel>
            <InputGroup size="md">
              <Input
                name="ap-password"
                isRequired
                placeholder="Password"
                mb={3}
                type={state.showAPPassword ? 'text' : 'password'}
                value={state.apPassword}
                onChange={(event) => actions.setApPassword(event.target.value)}
              />
              <InputRightElement display="flex" alignItems="center" mt="4px">
                <Icon
                  color="gray.400"
                  _hover={{ cursor: 'pointer' }}
                  as={state.showAPPassword ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                  onClick={() => actions.setShowAPPassword(!state.showAPPassword)}
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>
          <Text fontSize="sm" color="secondaryGray.500" mb={3}>
            Note: AP settings are managed by Pi setup scripts. Changes here are for display only.
          </Text>
          {state.isAPSectionDirty ? <Button isDisabled>Save</Button> : null}
        </Flex>
      </Card>
      <Card alignItems="center" flexDirection="column" w="100%" my={4}>
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <Text me="auto" fontSize="xl" fontWeight="700" lineHeight="100%">
            Wi-Fi
          </Text>
          <Text my={4}>
            The upstream wireless network is used for connecting the Raspberry PI to your network and to the internet.
          </Text>
          <FormControl w="50%">
            <FormLabel ms="4px" fontWeight="500" display="flex">
              Network Name<Text color="brand.500">*</Text>
            </FormLabel>
            <Select
              placeholder="Select a network"
              mb={3}
              value={state.wifiNetworkName}
              onChange={(event) => actions.setWifiNetworkName(event.target.value)}
            >
              <option value="option1">Option 1</option>
              <option value="option2">Option 2</option>
              <option value="option3">Option 3</option>
            </Select>
          </FormControl>
          <FormControl w="50%">
            <FormLabel ms="4px" fontWeight="500" display="flex">
              Password (WPA2)<Text color="brand.500">*</Text>
            </FormLabel>
            <InputGroup size="md">
              <Input
                name="wifi-password"
                isRequired
                placeholder="Password"
                mb={3}
                type={state.showWifiPassword ? 'text' : 'password'}
                value={state.wifiPassword}
                onChange={(event) => actions.setWifiPassword(event.target.value)}
              />
              <InputRightElement display="flex" alignItems="center" mt="4px">
                <Icon
                  color="gray.400"
                  _hover={{ cursor: 'pointer' }}
                  as={state.showWifiPassword ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                  onClick={() => actions.setShowWifiPassword(!state.showWifiPassword)}
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>
          <Text fontSize="sm" color="secondaryGray.500" mb={3}>
            Note: WiFi settings are managed by Pi system configuration. Changes here are for display only.
          </Text>
          {state.isWifiSectionDirty ? <Button isDisabled>Save</Button> : null}
        </Flex>
      </Card>
      <DevicesCard devices={devices} />
    </Box>
  );
};
