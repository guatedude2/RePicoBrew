import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Icon,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import { useFetcher } from '@remix-run/react';
import { useEffect, useState, type FC } from 'react';
import { MdDelete, MdEdit, MdMoreVert, MdPersonAdd } from 'react-icons/md';
import Card from '~/components/card/Card';

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

interface UsersCardProps {
  users: User[];
}

const ROLES = [
  { value: 'Regular', label: 'Regular User' },
  { value: 'ReadOnly', label: 'Read-only' },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const UserRow: FC<{
  user: User;
  onEdit: () => void;
  onDelete: () => void;
  deleteBusy: boolean;
}> = ({ user, onEdit, onDelete, deleteBusy }) => (
  <Flex
    align="center"
    gap="12px"
    px="14px"
    py="12px"
    borderTop="1px solid"
    borderColor="ink.divider"
    _first={{ borderTop: 'none' }}
  >
    <Flex
      w="34px"
      h="34px"
      borderRadius="full"
      bg="ink.bg"
      align="center"
      justify="center"
      fontSize="13px"
      fontWeight="700"
      color="ink.textSecondary"
      flex="0 0 auto"
    >
      {initialsFor(user.name)}
    </Flex>
    <Box flex="1" minW="0">
      <Text fontSize="13px" fontWeight="600">
        {user.name}
      </Text>
      <Text fontSize="11px" color="ink.textFaint">
        {user.email}
      </Text>
    </Box>
    <Text fontSize="12px" color="ink.textSecondary" flex="0 0 auto">
      {ROLE_LABEL[user.role] ?? user.role}
    </Text>
    <Menu placement="bottom-end">
      <MenuButton
        as={IconButton}
        aria-label="User actions"
        icon={<Icon as={MdMoreVert} boxSize="18px" />}
        variant="ghost"
        size="sm"
        flex="0 0 auto"
      />
      <MenuList>
        <MenuItem icon={<Icon as={MdEdit} />} onClick={onEdit}>
          Edit
        </MenuItem>
        <MenuItem icon={<Icon as={MdDelete} />} color="danger.500" isDisabled={deleteBusy} onClick={onDelete}>
          Delete
        </MenuItem>
      </MenuList>
    </Menu>
  </Flex>
);

export const UsersCard: FC<UsersCardProps> = ({ users }) => {
  const addDisclosure = useDisclosure();
  const editDisclosure = useDisclosure();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Regular');
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('Regular');
  const addFetcher = useFetcher();
  const editFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  const handleAdd = () => {
    addFetcher.submit({ intent: 'addUser', name, email, password, role }, { method: 'post' });
    addDisclosure.onClose();
    setName('');
    setEmail('');
    setPassword('');
    setRole('Regular');
  };

  const openEdit = (user: User) => {
    setEditTarget(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    editDisclosure.onOpen();
  };

  const handleEditSave = () => {
    if (!editTarget) {
      return;
    }
    editFetcher.submit(
      { intent: 'updateUser', id: String(editTarget.id), name: editName, email: editEmail, role: editRole },
      { method: 'post' },
    );
    editDisclosure.onClose();
  };

  useEffect(() => {
    if (editFetcher.state === 'idle') {
      setEditTarget(null);
    }
  }, [editFetcher.state]);

  return (
    <>
      <Card p="24px">
        <Flex justify="space-between" align="center" mb="14px">
          <Text fontSize="17px" fontWeight="700">
            Users
          </Text>
          <Button leftIcon={<Icon as={MdPersonAdd} />} variant="brand" size="sm" onClick={addDisclosure.onOpen}>
            Add User
          </Button>
        </Flex>

        <Box
          display="flex"
          flexDirection="column"
          border="1px solid"
          borderColor="ink.divider"
          borderRadius="10px"
          overflow="hidden"
        >
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onEdit={() => openEdit(user)}
              onDelete={() => deleteFetcher.submit({ intent: 'deleteUser', id: String(user.id) }, { method: 'post' })}
              deleteBusy={deleteFetcher.state !== 'idle'}
            />
          ))}
        </Box>
      </Card>

      <Modal isOpen={addDisclosure.isOpen} onClose={addDisclosure.onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={addDisclosure.onClose}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleAdd} isDisabled={!name || !email || !password}>
              Add User
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={editDisclosure.isOpen} onClose={editDisclosure.onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editDisclosure.onClose}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isLoading={editFetcher.state !== 'idle'}
              isDisabled={!editName || !editEmail}
              onClick={handleEditSave}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
