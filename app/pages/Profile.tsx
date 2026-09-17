import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Text,
} from '@chakra-ui/react';
import { useFetcher, useRouteLoaderData } from 'react-router';
import { useState, type FC } from 'react';
import { MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import Card from '~/components/card/Card';

const ROLE_LABEL: Record<string, string> = {
  Regular: 'Regular User',
  ReadOnly: 'Read-only',
};

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const InfoRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <Flex
    justify="space-between"
    px="16px"
    py="12px"
    bg="ink.bg"
    borderTop="1px solid"
    borderColor="ink.divider"
    fontSize="13px"
    _first={{ borderTop: 'none' }}
  >
    <Text color="ink.textFaint">{label}</Text>
    <Text color="ink.text" fontWeight="600">
      {value}
    </Text>
  </Flex>
);

const PasswordField: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}> = ({ label, value, onChange, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <FormControl>
      <FormLabel fontSize="12px" fontWeight="600" color="ink.textSecondary" mb="6px">
        {label}
      </FormLabel>
      <InputGroup>
        <Input
          type={show ? 'text' : 'password'}
          placeholder="••••••••"
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
        <InputRightElement>
          <Icon
            color="ink.textFaint"
            _hover={{ cursor: 'pointer' }}
            as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye}
            onClick={() => setShow(!show)}
          />
        </InputRightElement>
      </InputGroup>
    </FormControl>
  );
};

export const Profile: FC = () => {
  const adminData = useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin');
  const session = adminData?.session;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();

  const mismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = Boolean(currentPassword && newPassword && newPassword === confirmPassword);

  const updatePassword = () => {
    if (!canSubmit) {
      return;
    }
    fetcher.submit(
      { intent: 'changePassword', currentPassword, newPassword },
      { method: 'post', encType: 'application/json' },
    );
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (!session) {
    return null;
  }

  return (
    <Box maxW="480px" display="flex" flexDirection="column" gap="18px">
      <Text fontSize="26px" fontWeight="700" letterSpacing="-0.3px">
        My Profile
      </Text>

      <Card p="24px" display="flex" flexDirection="column" gap="18px">
        <Flex align="center" gap="16px">
          <Flex
            w="56px"
            h="56px"
            borderRadius="full"
            bgGradient="linear(155deg, gray.500, gray.700)"
            border="1px solid"
            borderColor="ink.borderStrong"
            align="center"
            justify="center"
            fontSize="18px"
            fontWeight="700"
            color="white"
            flex="0 0 auto"
          >
            {initialsFor(session.name)}
          </Flex>
          <Box>
            <Text fontSize="18px" fontWeight="700">
              {session.name}
            </Text>
            <Text fontSize="13px" color="ink.textFaint">
              {ROLE_LABEL[session.role] ?? session.role}
            </Text>
          </Box>
        </Flex>

        <Box
          display="flex"
          flexDirection="column"
          border="1px solid"
          borderColor="ink.divider"
          borderRadius="10px"
          overflow="hidden"
        >
          <InfoRow label="Name" value={session.name} />
          <InfoRow label="Email" value={session.email} />
          <InfoRow label="Role" value={ROLE_LABEL[session.role] ?? session.role} />
        </Box>
      </Card>

      <Card p="24px" display="flex" flexDirection="column" gap="16px">
        <Text fontSize="15px" fontWeight="700">
          Password
        </Text>

        {fetcher.data?.error && (
          <Text fontSize="12px" color="danger.500">
            {fetcher.data.error}
          </Text>
        )}
        {fetcher.data?.success && (
          <Text fontSize="12px" color="success.500">
            Password updated.
          </Text>
        )}

        <PasswordField
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <Flex gap="14px" wrap="wrap">
          <Box flex="1" minW="150px">
            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
          </Box>
          <Box flex="1" minW="150px">
            <PasswordField
              label="Confirm Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </Box>
        </Flex>
        {mismatch && (
          <Text fontSize="12px" color="danger.500">
            Passwords don&apos;t match.
          </Text>
        )}
        <Button
          variant="brand"
          alignSelf="flex-start"
          isDisabled={!canSubmit}
          isLoading={fetcher.state !== 'idle'}
          onClick={updatePassword}
        >
          Update Password
        </Button>
      </Card>
    </Box>
  );
};

export default Profile;
