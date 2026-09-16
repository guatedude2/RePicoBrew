import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, Link, useFetcher } from '@remix-run/react';
import {
  Box,
  Button,
  Flex,
  Icon,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  Badge,
  HStack,
} from '@chakra-ui/react';
import { MdAdd, MdDelete, MdEdit } from 'react-icons/md';
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

  return json({ error: 'Unknown intent' }, { status: 400 });
};

export default function RecipesPage() {
  const { recipes } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Card alignItems="center" flexDirection="column" w="100%">
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <Flex w="100%" justify="space-between" align="center" mb={4}>
            <Text fontSize="xl" fontWeight="700" lineHeight="100%">
              Recipes
            </Text>
            <Link to="/recipes/new">
              <Button leftIcon={<Icon as={MdAdd} />} colorScheme="brand" size="sm">
                New Recipe
              </Button>
            </Link>
          </Flex>

          {recipes.length === 0 ? (
            <Flex w="100%" justify="center" align="center" py={8} direction="column">
              <Text color="secondaryGray.600">No recipes yet</Text>
              <Link to="/recipes/new">
                <Button mt={4} colorScheme="brand" size="sm">
                  Create Your First Recipe
                </Button>
              </Link>
            </Flex>
          ) : (
            <Box w="100%" overflowX="auto">
              <Table variant="simple" color="gray.500" mt={4}>
                <Thead>
                  <Tr>
                    <Th borderColor={borderColor}>Name</Th>
                    <Th borderColor={borderColor}>Style</Th>
                    <Th borderColor={borderColor}>ABV</Th>
                    <Th borderColor={borderColor}>IBU</Th>
                    <Th borderColor={borderColor}>Type</Th>
                    <Th borderColor={borderColor}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {recipes.map((recipe) => (
                    <Tr key={recipe.id}>
                      <Td borderColor={borderColor}>
                        <Text color={textColor} fontSize="sm" fontWeight="700">
                          {recipe.name}
                        </Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Text color={textColor} fontSize="sm">
                          {recipe.style || '-'}
                        </Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Text color={textColor} fontSize="sm">
                          {recipe.abv.toFixed(1)}%
                        </Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Text color={textColor} fontSize="sm">
                          {recipe.ibu}
                        </Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Badge colorScheme="blue">{recipe.deviceType}</Badge>
                      </Td>
                      <Td borderColor={borderColor}>
                        <HStack spacing={2}>
                          <Link to={`/recipes/${recipe.id}`}>
                            <Button size="xs" leftIcon={<Icon as={MdEdit} />} variant="ghost">
                              Edit
                            </Button>
                          </Link>
                          <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="id" value={recipe.id} />
                            <Button
                              size="xs"
                              leftIcon={<Icon as={MdDelete} />}
                              variant="ghost"
                              colorScheme="red"
                              type="submit"
                              onClick={(e) => {
                                if (!confirm('Are you sure you want to delete this recipe?')) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </fetcher.Form>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Flex>
      </Card>
    </Box>
  );
}
