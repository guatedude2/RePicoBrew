import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, Link, useFetcher, useNavigate } from '@remix-run/react';
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
} from '@chakra-ui/react';
import { useState, type FC } from 'react';
import { MdAdd, MdContentCopy, MdDelete, MdEdit, MdMoreVert } from 'react-icons/md';
import Card from '~/components/card/Card';
import { RecipeRepository } from '~/repositories/recipe.server';

export const meta = () => [{ title: 'Recipes | RePicoBrew' }];

export const loader = async (_args: LoaderArgs) => {
  const recipes = await RecipeRepository.getAllRecipes();
  return json({ recipes });
};

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    const id = parseInt(formData.get('id') as string);
    await RecipeRepository.deleteRecipe(id);
    return json({ success: true });
  }

  if (intent === 'duplicate') {
    const id = parseInt(formData.get('id') as string);
    await RecipeRepository.duplicateRecipe(id);
    return json({ success: true });
  }

  return json({ error: 'Unknown intent' }, { status: 400 });
};

const columns = '1.6fr 1.1fr 0.8fr 0.8fr 1fr 1fr';

type Recipe = ReturnType<typeof useLoaderData<typeof loader>>['recipes'][number];

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
  const { recipes } = useLoaderData<typeof loader>();
  const deleteFetcher = useFetcher();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

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
            <Button variant="brand" leftIcon={<Icon as={MdAdd} />}>
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
              <Text>Name</Text>
              <Text>Style</Text>
              <Text>ABV</Text>
              <Text>IBU</Text>
              <Text>Type</Text>
              <Text>Actions</Text>
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
