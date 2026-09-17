import { Box, Button, Flex, Icon, Image, Input, Select, Text } from '@chakra-ui/react';
import { Form, useActionData, useNavigate, useNavigation } from 'react-router';
import { useMemo, useState, type FC } from 'react';
import { MdArrowBack } from 'react-icons/md';
import Card from '~/components/card/Card';

const CARB_METHODS = [
  { label: 'Bottle', unit: 'weeks' },
  { label: 'Keg', unit: 'weeks' },
  { label: 'Forced (CO2)', unit: 'hours' },
];

interface RecipeOption {
  id: number;
  name: string;
  style: string | null;
  abv: number;
  ibu: number;
  photoUrl: string | null;
  fermentDays: number | null;
  steps: Array<{ stepTime: number; drainTime: number }>;
}

interface DeviceOption {
  id: number;
  name: string;
  color: string | null;
}

interface NewSessionProps {
  recipes: RecipeOption[];
  brewDevices: DeviceOption[];
  tiltDevices: DeviceOption[];
}

const formatMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
};

export const NewSession: FC<NewSessionProps> = ({ recipes, brewDevices, tiltDevices }) => {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<{ error?: string }>();

  const [recipeId, setRecipeId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [fermentDeviceId, setFermentDeviceId] = useState('');
  const [carbMethod, setCarbMethod] = useState('Bottle');
  const [carbDuration, setCarbDuration] = useState(2);

  const recipe = useMemo(() => recipes.find((r) => r.id === Number(recipeId)) ?? null, [recipes, recipeId]);
  const carbUnit = CARB_METHODS.find((m) => m.label === carbMethod)?.unit ?? 'weeks';

  const brewMinutes = useMemo(() => recipe?.steps.reduce((sum, s) => sum + s.stepTime + s.drainTime, 0) ?? 0, [recipe]);

  const estimate = useMemo(() => {
    const parts: string[] = [];
    if (recipe) {
      parts.push(`${formatMinutes(brewMinutes)} brew`);
    }
    if (recipe?.fermentDays) {
      parts.push(`${recipe.fermentDays}d ferment`);
    }
    parts.push(`${carbDuration}${carbUnit === 'weeks' ? 'w' : 'h'} carb`);
    return parts.join(' + ');
  }, [recipe, brewMinutes, carbDuration, carbUnit]);

  const isSubmitting = navigation.state === 'submitting';

  return (
    <>
      <Flex align="center" gap="12px" mb="4px">
        <Box
          as="button"
          type="button"
          onClick={() => navigate('/sessions')}
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="32px"
          h="32px"
          borderRadius="7px"
          bg="ink.card"
          border="1px solid"
          borderColor="ink.cardBorder"
        >
          <Icon as={MdArrowBack} boxSize="15px" />
        </Box>
        <Text fontSize="19px" fontWeight="700">
          New Session
        </Text>
      </Flex>

      <Form method="post">
        <Box display="flex" flexDirection="column" gap="16px" maxW="720px">
          <Card p="22px" gap="16px">
            <Text fontSize="14px" fontWeight="700">
              Recipe
            </Text>
            <Select
              name="recipeId"
              placeholder="Select a recipe"
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.style || 'Unspecified style'}
                </option>
              ))}
            </Select>

            {recipe && (
              <Flex align="center" gap="14px" p="12px" bg="ink.bg" borderRadius="10px">
                <Image
                  src={recipe.photoUrl || '/img/no-photo.jpg'}
                  alt={recipe.name}
                  boxSize="56px"
                  objectFit="cover"
                  borderRadius="8px"
                  flexShrink={0}
                />
                <Box flex="1" minW="0">
                  <Text fontSize="14px" fontWeight="700" noOfLines={1}>
                    {recipe.name}
                  </Text>
                  <Text fontSize="12px" color="ink.textFaint" mb="6px">
                    {recipe.style || 'Unspecified style'}
                  </Text>
                  <Flex gap="18px" fontSize="11px" color="ink.textSecondary">
                    <Box>
                      <Text color="ink.textFaint">ABV</Text>
                      <Text fontWeight="700">{recipe.abv.toFixed(1)}%</Text>
                    </Box>
                    <Box>
                      <Text color="ink.textFaint">IBU</Text>
                      <Text fontWeight="700">{recipe.ibu}</Text>
                    </Box>
                    <Box>
                      <Text color="ink.textFaint">Est. Brew Time</Text>
                      <Text fontWeight="700">{formatMinutes(brewMinutes)}</Text>
                    </Box>
                  </Flex>
                </Box>
              </Flex>
            )}
          </Card>

          <Card p="22px" gap="16px">
            <Text fontSize="14px" fontWeight="700">
              Devices
            </Text>
            <Flex gap="16px" wrap="wrap">
              <Box flex="1" minW="220px">
                <Text fontSize="11px" fontWeight="600" color="ink.textSecondary" mb="6px">
                  Brew Device *
                </Text>
                <Select
                  name="deviceId"
                  placeholder="Select a device"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                >
                  {brewDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Box>
              <Box flex="1" minW="220px">
                <Text fontSize="11px" fontWeight="600" color="ink.textSecondary" mb="6px">
                  Ferment Device (optional)
                </Text>
                <Select
                  name="fermentDeviceId"
                  value={fermentDeviceId}
                  onChange={(e) => setFermentDeviceId(e.target.value)}
                >
                  <option value="">None — manual tracking</option>
                  {tiltDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      Tilt · {d.color || d.name}
                    </option>
                  ))}
                </Select>
              </Box>
            </Flex>
          </Card>

          <Card p="22px" gap="14px">
            <Box>
              <Text fontSize="14px" fontWeight="700">
                Carbonation
              </Text>
              <Text fontSize="12px" color="ink.textFaint">
                Manual step — no sensor tracking. Choose method and how long.
              </Text>
            </Box>
            <Flex gap="8px" wrap="wrap">
              {CARB_METHODS.map((m) => (
                <Box
                  key={m.label}
                  as="button"
                  type="button"
                  onClick={() => setCarbMethod(m.label)}
                  px="14px"
                  py="9px"
                  borderRadius="8px"
                  bg={carbMethod === m.label ? 'brand.100' : 'ink.bg'}
                  border="1px solid"
                  borderColor={carbMethod === m.label ? 'brand.500' : 'ink.divider'}
                  color={carbMethod === m.label ? 'ink.text' : 'ink.textSecondary'}
                  fontSize="13px"
                  fontWeight="600"
                >
                  {m.label}
                </Box>
              ))}
            </Flex>
            <input type="hidden" name="carbMethod" value={carbMethod} />
            <Box maxW="200px">
              <Text fontSize="11px" fontWeight="600" color="ink.textSecondary" mb="6px">
                Duration ({carbUnit})
              </Text>
              <Input
                type="number"
                name="carbDuration"
                value={carbDuration}
                onChange={(e) => setCarbDuration(Number(e.target.value))}
                min={1}
                fontFamily="mono"
              />
            </Box>
          </Card>

          {actionData?.error && (
            <Text fontSize="13px" color="danger.500">
              {actionData.error}
            </Text>
          )}

          <Flex align="center" justify="space-between" wrap="wrap" gap="12px">
            <Box>
              <Text fontSize="10px" fontWeight="700" color="ink.textFaint" letterSpacing="0.5px">
                ESTIMATED TOTAL TIME
              </Text>
              <Text fontSize="14px" fontFamily="mono" fontWeight="700">
                {estimate}
              </Text>
            </Box>
            <Button type="submit" variant="brand" isDisabled={!recipeId || !deviceId} isLoading={isSubmitting}>
              Start Brewing
            </Button>
          </Flex>
        </Box>
      </Form>
    </>
  );
};

export default NewSession;
