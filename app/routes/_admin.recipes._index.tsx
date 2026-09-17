import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { useLoaderData, Link, useFetcher, useNavigate, useSearchParams } from 'react-router';
import {
  Box,
  Button,
  Flex,
  Grid,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Portal,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { useState, type FC } from 'react';
import { MdAdd, MdArrowDownward, MdArrowUpward, MdContentCopy, MdDelete, MdEdit, MdMoreVert } from 'react-icons/md';
import Card from '~/components/card/Card';
import { RecipeRepository } from '~/repositories/recipe.server';

export const meta = () => [{ title: 'Recipes | RePicoBrew' }];

type SortKey = 'name' | 'style' | 'abv' | 'ibu' | 'sessions' | 'type';
type SortDir = 'asc' | 'desc';
const SORT_KEYS: SortKey[] = ['name', 'style', 'abv', 'ibu', 'sessions', 'type'];
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  style: 'asc',
  abv: 'desc',
  ibu: 'desc',
  sessions: 'desc',
  type: 'asc',
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const sortParam = url.searchParams.get('sort');
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'name';
  const dirParam = url.searchParams.get('dir');
  const dir: SortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : DEFAULT_DIR[sort];

  const recipes = await RecipeRepository.getAllRecipesWithSessionCounts();
  const sorted = [...recipes].sort((a, b) => {
    const cmp = (() => {
      switch (sort) {
        case 'style':
          return (a.style ?? '').localeCompare(b.style ?? '');
        case 'abv':
          return a.abv - b.abv;
        case 'ibu':
          return a.ibu - b.ibu;
        case 'sessions':
          return a.sessionCount - b.sessionCount;
        case 'type':
          return a.deviceType.localeCompare(b.deviceType);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    })();
    return dir === 'asc' ? cmp : -cmp;
  });

  return { recipes: sorted, sort, dir };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    const id = parseInt(formData.get('id') as string);
    await RecipeRepository.deleteRecipe(id);
    return { success: true };
  }

  if (intent === 'duplicate') {
    const id = parseInt(formData.get('id') as string);
    await RecipeRepository.duplicateRecipe(id);
    return { success: true };
  }

  return data({ error: 'Unknown intent' }, { status: 400 });
};

const columns = '1.6fr 1.1fr 0.8fr 0.8fr 0.9fr 1fr 1fr';

type Recipe = ReturnType<typeof useLoaderData<typeof loader>>['recipes'][number];

const SortableHeader: FC<{ label: string; sortKey: SortKey; activeSort: SortKey; dir: SortDir; href: string }> = ({
  label,
  sortKey,
  activeSort,
  dir,
  href,
}) => {
  const isActive = activeSort === sortKey;
  return (
    <Link to={href} style={{ textDecoration: 'none' }}>
      <Flex align="center" gap="4px" color={isActive ? 'ink.text' : 'ink.textFaint'} _hover={{ color: 'ink.text' }}>
        <Text>{label}</Text>
        {isActive && <Icon as={dir === 'asc' ? MdArrowUpward : MdArrowDownward} boxSize="12px" />}
      </Flex>
    </Link>
  );
};

const RecipeRow: FC<{ recipe: Recipe; onRequestDelete: (recipe: Recipe) => void }> = ({ recipe, onRequestDelete }) => {
  const navigate = useNavigate();
  const duplicateFetcher = useFetcher();

  return (
    <Grid
      templateColumns={columns}
      minW="720px"
      px="20px"
      py="16px"
      alignItems="center"
      borderBottom="1px solid"
      borderColor="ink.divider"
      cursor="pointer"
      _hover={{ bg: 'ink.cardHover' }}
      onClick={() => navigate(`/recipes/${recipe.id}?mode=view`)}
    >
      <Flex align="center" gap="10px">
        <Box w="7px" h="7px" borderRadius="full" bg="brand.500" />
        <Text fontSize="14px" fontWeight="700">
          {recipe.name}
        </Text>
      </Flex>
      <Text fontSize="13px" color="ink.textSecondary">
        {recipe.style || '-'}
      </Text>
      <Box
        as="span"
        fontSize="11px"
        fontWeight="700"
        px="8px"
        py="3px"
        borderRadius="6px"
        bg="brand.100"
        color="brand.500"
        w="fit-content"
      >
        {recipe.abv.toFixed(1)}%
      </Box>
      <Box
        as="span"
        fontSize="11px"
        fontWeight="700"
        px="8px"
        py="3px"
        borderRadius="6px"
        bg="accentLime.100"
        color="accentLime.500"
        w="fit-content"
      >
        {recipe.ibu} IBU
      </Box>
      <Tooltip
        label={`${recipe.completedSessionCount} completed out of ${recipe.sessionCount} ${
          recipe.sessionCount === 1 ? 'session' : 'sessions'
        }`}
        fontSize="12px"
      >
        <Text fontSize="13px" color="ink.textSecondary" w="fit-content" fontFamily="mono">
          {recipe.completedSessionCount}/{recipe.sessionCount}
        </Text>
      </Tooltip>
      <Box
        as="span"
        fontSize="11px"
        fontWeight="700"
        px="8px"
        py="3px"
        borderRadius="6px"
        bg="info.100"
        color="info.500"
        w="fit-content"
      >
        {recipe.deviceType}
      </Box>
      <Flex justify="flex-end" onClick={(e) => e.stopPropagation()}>
        <Menu placement="bottom-end">
          <MenuButton
            as={IconButton}
            aria-label="Recipe actions"
            icon={<Icon as={MdMoreVert} boxSize="18px" />}
            variant="ghost"
            size="sm"
          />
          <Portal>
            <MenuList>
              <MenuItem icon={<Icon as={MdEdit} />} onClick={() => navigate(`/recipes/${recipe.id}`)}>
                Edit
              </MenuItem>
              <MenuItem
                icon={<Icon as={MdContentCopy} />}
                isDisabled={duplicateFetcher.state !== 'idle'}
                onClick={() =>
                  duplicateFetcher.submit({ intent: 'duplicate', id: String(recipe.id) }, { method: 'post' })
                }
              >
                Duplicate
              </MenuItem>
              <MenuItem icon={<Icon as={MdDelete} />} color="danger.500" onClick={() => onRequestDelete(recipe)}>
                Delete
              </MenuItem>
            </MenuList>
          </Portal>
        </Menu>
      </Flex>
    </Grid>
  );
};

export default function RecipesPage() {
  const { recipes, sort, dir } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const deleteFetcher = useFetcher();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const sortHref = (key: SortKey) => {
    let nextDir: SortDir = DEFAULT_DIR[key];
    if (sort === key) {
      nextDir = dir === 'asc' ? 'desc' : 'asc';
    }
    const params = new URLSearchParams(searchParams);
    params.set('sort', key);
    params.set('dir', nextDir);
    return `?${params.toString()}`;
  };

  return (
    <>
      <Flex align="flex-end" justify="space-between" gap="16px" wrap="wrap">
        <Box>
          <Text fontSize="26px" fontWeight="700" letterSpacing="-0.3px">
            Recipes
          </Text>
          <Text fontSize="14px" color="ink.textDim" mt="4px">
            Manage your brewing recipes
          </Text>
        </Box>
        <Flex align="center" gap="12px">
          <Box
            fontSize="12px"
            fontWeight="700"
            px="12px"
            py="5px"
            borderRadius="999px"
            bg="brand.100"
            color="brand.500"
          >
            {recipes.length} Total
          </Box>
          <Link to="/recipes/new">
            <Button variant="brand" size="sm" leftIcon={<Icon as={MdAdd} />}>
              New Recipe
            </Button>
          </Link>
        </Flex>
      </Flex>

      <Card overflow="hidden" p="0">
        {recipes.length === 0 ? (
          <Flex direction="column" align="center" gap="14px" py="64px">
            <Text fontSize="19px" fontWeight="700">
              No Recipes Yet
            </Text>
            <Text fontSize="14px" color="ink.textFaint" textAlign="center" maxW="380px">
              Create your first recipe to start brewing with your Pico device
            </Text>
            <Link to="/recipes/new">
              <Button variant="brand" leftIcon={<Icon as={MdAdd} />}>
                Create Your First Recipe
              </Button>
            </Link>
          </Flex>
        ) : (
          <Box overflowX="auto">
            <Grid
              templateColumns={columns}
              minW="720px"
              px="20px"
              py="14px"
              fontSize="11px"
              fontWeight="700"
              letterSpacing="0.5px"
              color="ink.textFaint"
              textTransform="uppercase"
              borderBottom="1px solid"
              borderColor="ink.divider"
            >
              <SortableHeader label="Name" sortKey="name" activeSort={sort} dir={dir} href={sortHref('name')} />
              <SortableHeader label="Style" sortKey="style" activeSort={sort} dir={dir} href={sortHref('style')} />
              <SortableHeader label="ABV" sortKey="abv" activeSort={sort} dir={dir} href={sortHref('abv')} />
              <SortableHeader label="IBU" sortKey="ibu" activeSort={sort} dir={dir} href={sortHref('ibu')} />
              <SortableHeader
                label="Sessions"
                sortKey="sessions"
                activeSort={sort}
                dir={dir}
                href={sortHref('sessions')}
              />
              <SortableHeader label="Type" sortKey="type" activeSort={sort} dir={dir} href={sortHref('type')} />
              <Box />
            </Grid>
            {recipes.map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onRequestDelete={(r) => setDeleteTarget({ id: r.id, name: r.name })}
              />
            ))}
          </Box>
        )}
      </Card>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete this recipe?</ModalHeader>
          <ModalBody>
            <Text fontSize="14px" color="ink.textSecondary">
              This removes {deleteTarget?.name} from your recipe list. This can&apos;t be undone.
            </Text>
          </ModalBody>
          <ModalFooter gap="10px">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              isLoading={deleteFetcher.state !== 'idle'}
              onClick={() => {
                if (!deleteTarget) {
                  return;
                }
                deleteFetcher.submit({ intent: 'delete', id: String(deleteTarget.id) }, { method: 'post' });
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
