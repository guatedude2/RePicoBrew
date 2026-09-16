import type { ActionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useNavigate, Form } from '@remix-run/react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  VStack,
  HStack,
  Icon,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  NumberInput,
  NumberInputField,
  useColorModeValue,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { MdAdd, MdDelete, MdSave, MdArrowBack } from 'react-icons/md';
import { useState } from 'react';
import Card from '~/components/card/Card';
import { RecipeRepository, PicoLocationMap, type CreateRecipeInput } from '~/repositories/recipe.server';
import { DeviceType } from '~/types';

export const meta = () => [{ title: 'New Recipe | RePicoBrew' }];

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const data = JSON.parse(formData.get('data') as string) as CreateRecipeInput;

  await RecipeRepository.createRecipe(data);
  return redirect('/recipes');
};

const locationOptions = [
  { value: PicoLocationMap.Prime, label: 'Prime' },
  { value: PicoLocationMap.Mash, label: 'Mash' },
  { value: PicoLocationMap.PassThru, label: 'Pass Thru' },
  { value: PicoLocationMap.Adjunct1, label: 'Adjunct 1' },
  { value: PicoLocationMap.Adjunct2, label: 'Adjunct 2' },
  { value: PicoLocationMap.Adjunct3, label: 'Adjunct 3' },
  { value: PicoLocationMap.Adjunct4, label: 'Adjunct 4' },
];

const defaultSteps = [
  { name: 'Preparing To Brew', temperature: 70, stepTime: 3, drainTime: 0, location: PicoLocationMap.Prime },
  { name: 'Heating', temperature: 156, stepTime: 15, drainTime: 0, location: PicoLocationMap.Mash },
  { name: 'Dough In', temperature: 152, stepTime: 20, drainTime: 0, location: PicoLocationMap.Mash },
  { name: 'Mash 1', temperature: 152, stepTime: 30, drainTime: 0, location: PicoLocationMap.Mash },
  { name: 'Mash Out', temperature: 175, stepTime: 10, drainTime: 2, location: PicoLocationMap.Mash },
  { name: 'Hops 1', temperature: 207, stepTime: 60, drainTime: 5, location: PicoLocationMap.Adjunct1 },
];

export default function RecipeNewPage() {
  const navigate = useNavigate();
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');

  const [formData, setFormData] = useState<CreateRecipeInput>({
    name: '',
    deviceType: DeviceType.PICOBREW_C,
    abv: 5.5,
    ibu: 40,
    style: '',
    image: RecipeRepository.getDefaultImage(),
    notes: '',
    steps: defaultSteps,
  });

  const validation = RecipeRepository.validatePicoRecipe(formData.steps);

  const handleStepChange = (index: number, field: string, value: any) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        { name: 'New Step', temperature: 152, stepTime: 20, drainTime: 0, location: PicoLocationMap.Mash },
      ],
    });
  };

  const removeStep = (index: number) => {
    if (index < 3) {
      alert('Cannot remove the first 3 required steps!');
      return;
    }
    const newSteps = formData.steps.filter((_, i) => i !== index);
    setFormData({ ...formData, steps: newSteps });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      alert('Please fix validation errors before saving');
      return;
    }
  };

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Form method="post" onSubmit={handleSubmit}>
        <input type="hidden" name="data" value={JSON.stringify(formData)} />

        <Card alignItems="center" flexDirection="column" w="100%" mb={4}>
          <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
            <Flex w="100%" justify="space-between" align="center" mb={4}>
              <HStack>
                <IconButton
                  aria-label="Back"
                  icon={<Icon as={MdArrowBack} />}
                  onClick={() => navigate('/recipes')}
                  variant="ghost"
                />
                <Text fontSize="xl" fontWeight="700">
                  New Recipe
                </Text>
              </HStack>
              <Button leftIcon={<Icon as={MdSave} />} colorScheme="brand" type="submit" isDisabled={!validation.valid}>
                Create Recipe
              </Button>
            </Flex>

            {!validation.valid && (
              <Alert status="error" mb={4}>
                <AlertIcon />
                <VStack align="start" spacing={1}>
                  {validation.errors.map((error, i) => (
                    <Text key={i} fontSize="sm">
                      {error}
                    </Text>
                  ))}
                </VStack>
              </Alert>
            )}

            <VStack spacing={4} w="100%" align="stretch">
              <HStack spacing={4} w="100%">
                <FormControl isRequired flex={1}>
                  <FormLabel>Recipe Name</FormLabel>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Awesome IPA"
                  />
                </FormControl>

                <FormControl flex={1}>
                  <FormLabel>Style</FormLabel>
                  <Input
                    value={formData.style}
                    onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                    placeholder="American IPA"
                  />
                </FormControl>
              </HStack>

              <HStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>ABV %</FormLabel>
                  <NumberInput
                    value={formData.abv}
                    onChange={(_, val) => setFormData({ ...formData, abv: val })}
                    min={0}
                    max={20}
                    step={0.1}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>IBU</FormLabel>
                  <NumberInput
                    value={formData.ibu}
                    onChange={(_, val) => setFormData({ ...formData, ibu: val })}
                    min={0}
                    max={150}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>OG</FormLabel>
                  <NumberInput
                    value={formData.og}
                    onChange={(_, val) => setFormData({ ...formData, og: val })}
                    min={1}
                    max={1.2}
                    step={0.001}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>FG</FormLabel>
                  <NumberInput
                    value={formData.fg}
                    onChange={(_, val) => setFormData({ ...formData, fg: val })}
                    min={0.99}
                    max={1.1}
                    step={0.001}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel>Notes</FormLabel>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Brewing notes..."
                  rows={3}
                />
              </FormControl>
            </VStack>
          </Flex>
        </Card>

        <Card alignItems="center" flexDirection="column" w="100%">
          <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
            <Flex w="100%" justify="space-between" align="center" mb={4}>
              <Text fontSize="xl" fontWeight="700">
                Recipe Steps
              </Text>
              <Button leftIcon={<Icon as={MdAdd} />} size="sm" onClick={addStep}>
                Add Step
              </Button>
            </Flex>

            <Text fontSize="sm" color="red.500" mb={2}>
              ⚠️ DO NOT EDIT or MOVE the first 3 steps (Preparing / Heating / Dough In)
            </Text>

            <Box w="100%" overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th borderColor={borderColor}>#</Th>
                    <Th borderColor={borderColor}>Step Name</Th>
                    <Th borderColor={borderColor}>Temp (°F)</Th>
                    <Th borderColor={borderColor}>Time (min)</Th>
                    <Th borderColor={borderColor}>Drain (min)</Th>
                    <Th borderColor={borderColor}>Location</Th>
                    <Th borderColor={borderColor}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {formData.steps.map((step, index) => (
                    <Tr key={index} bg={index < 3 ? 'yellow.50' : undefined}>
                      <Td borderColor={borderColor}>{index + 1}</Td>
                      <Td borderColor={borderColor}>
                        <Input
                          value={step.name}
                          onChange={(e) => handleStepChange(index, 'name', e.target.value)}
                          isReadOnly={index < 3}
                          size="sm"
                        />
                      </Td>
                      <Td borderColor={borderColor}>
                        <NumberInput
                          value={step.temperature}
                          onChange={(_, val) => handleStepChange(index, 'temperature', val)}
                          min={32}
                          max={212}
                          size="sm"
                        >
                          <NumberInputField />
                        </NumberInput>
                      </Td>
                      <Td borderColor={borderColor}>
                        <NumberInput
                          value={step.stepTime}
                          onChange={(_, val) => handleStepChange(index, 'stepTime', val)}
                          min={0}
                          max={180}
                          size="sm"
                        >
                          <NumberInputField />
                        </NumberInput>
                      </Td>
                      <Td borderColor={borderColor}>
                        <NumberInput
                          value={step.drainTime}
                          onChange={(_, val) => handleStepChange(index, 'drainTime', val)}
                          min={0}
                          max={10}
                          size="sm"
                        >
                          <NumberInputField />
                        </NumberInput>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Select
                          value={step.location}
                          onChange={(e) => handleStepChange(index, 'location', parseInt(e.target.value))}
                          isDisabled={index < 3}
                          size="sm"
                        >
                          {locationOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </Td>
                      <Td borderColor={borderColor}>
                        {index >= 3 && (
                          <IconButton
                            aria-label="Delete step"
                            icon={<Icon as={MdDelete} />}
                            size="sm"
                            colorScheme="red"
                            variant="ghost"
                            onClick={() => removeStep(index)}
                          />
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Flex>
        </Card>
      </Form>
    </Box>
  );
}
