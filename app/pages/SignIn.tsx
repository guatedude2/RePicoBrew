import React from 'react';
// Chakra imports
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Text,
} from '@chakra-ui/react';
// Assets
import { Form, Link, useActionData } from 'react-router';
import { MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import type { action } from '~/routes/signin';

const getErrorMessage = (message: string | undefined) => {
  if (message === 'BAD_CREDENTIALS' || message === 'NOT_AUTHORIZED') {
    return 'Invalid email and/or password';
  }
  return 'Oh no, something went wrong';
};

const Logo = () => (
  <Flex align="center" gap="10px" mb="40px">
    <Flex
      w="36px"
      h="36px"
      borderRadius="9px"
      bgGradient="linear(155deg, brand.300, brand.600)"
      align="center"
      justify="center"
    >
      <Icon viewBox="0 0 24 24" boxSize="19px" color="ink.onBrand">
        <path d="M6 3h10l1 4H5l1-4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path
          d="M5 7h14l-1.4 12.2A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.8L5 7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </Icon>
    </Flex>
    <Box lineHeight="1.1">
      <Text fontWeight="700" fontSize="16px" letterSpacing="0.5px">
        REPICOBREW
      </Text>
      <Text fontSize="11px" color="ink.textFaint" letterSpacing="1px">
        CONTROL DECK
      </Text>
    </Box>
  </Flex>
);

export const SignIn = () => {
  const actionData = useActionData<typeof action>();
  const [show, setShow] = React.useState(false);
  const handleClick = () => setShow(!show);

  const isEmailError = Boolean(actionData && 'email' in actionData.error);
  const errorMessage = actionData && 'message' in actionData.error ? getErrorMessage(actionData.error.message) : null;

  return (
    <Flex minH="100vh" w="100%" wrap="wrap" bg="ink.bg">
      <Flex flex="1" minW="340px" align="center" justify="center" p={{ base: '24px', md: '40px' }}>
        <Box w="100%" maxW="400px">
          <Logo />
          <Text fontSize="28px" fontWeight="700" letterSpacing="-0.3px" mb="8px">
            Sign in
          </Text>
          <Text fontSize="14px" color="ink.textDim" mb="32px">
            Enter your email and password to access your brew rig.
          </Text>

          <Flex as={Form} method="post" noValidate direction="column" gap="18px">
            {errorMessage ? (
              <Text color="danger.500" textAlign="center">
                {errorMessage}
              </Text>
            ) : null}
            <FormControl isInvalid={isEmailError}>
              <FormLabel fontSize="12px" fontWeight="600" color="ink.textSecondary" mb="6px">
                Email
              </FormLabel>
              <Input name="email" isRequired type="email" placeholder="you@example.com" size="lg" />
              {isEmailError ? <FormErrorMessage>A valid email is required.</FormErrorMessage> : null}
            </FormControl>
            <FormControl>
              <FormLabel fontSize="12px" fontWeight="600" color="ink.textSecondary" mb="6px">
                Password
              </FormLabel>
              <InputGroup size="lg">
                <Input name="password" isRequired placeholder="••••••••" type={show ? 'text' : 'password'} />
                <InputRightElement display="flex" alignItems="center">
                  <Icon
                    color="ink.textFaint"
                    _hover={{ cursor: 'pointer' }}
                    as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                    onClick={handleClick}
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <Flex justify="space-between" align="center">
              <FormControl display="flex" alignItems="center" w="auto">
                <Checkbox id="remember-login" name="remember" colorScheme="brand" me="8px" />
                <FormLabel htmlFor="remember-login" mb="0" fontWeight="400" color="ink.textSecondary" fontSize="13px">
                  Keep me logged in
                </FormLabel>
              </FormControl>
              <Link to="/auth/forgot-password">
                <Text fontSize="13px" fontWeight="600" color="brand.500">
                  Forgot password?
                </Text>
              </Link>
            </Flex>
            <Button type="submit" variant="brand" size="lg" mt="4px">
              Sign In
            </Button>
          </Flex>
        </Box>
      </Flex>

      <Box flex="1" position="relative" minW="320px" minH="320px" display={{ base: 'none', md: 'block' }}>
        <Box
          position="absolute"
          inset={0}
          bgGradient="linear(155deg, gray.700, ink.bg)"
          bgImage="url(/img/signin-hero.jpg)"
          bgSize="cover"
          bgPosition="center"
        />
        <Box
          position="absolute"
          inset={0}
          bgGradient="linear(to-b, transparent 40%, oklch(0.15 0.004 260 / 0.92) 100%)"
        />
        <Box position="absolute" bottom="32px" left="32px" right="32px">
          <Text fontSize="20px" fontWeight="700">
            Brew with precision.
          </Text>
          <Text fontSize="13px" color="ink.textSecondary" mt="4px">
            Live tracking for every batch, from mash to fermentation.
          </Text>
        </Box>
        <Text position="absolute" bottom="8px" right="12px" fontSize="10px" color="whiteAlpha.700">
          Photo by{' '}
          <Text
            as="a"
            href="https://unsplash.com/@merittthomas?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
            target="_blank"
            rel="noopener noreferrer"
            textDecoration="underline"
          >
            Meritt Thomas
          </Text>{' '}
          on{' '}
          <Text
            as="a"
            href="https://unsplash.com/photos/clear-drinking-glass-with-beer-2UsNF4Az-Ko?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
            target="_blank"
            rel="noopener noreferrer"
            textDecoration="underline"
          >
            Unsplash
          </Text>
        </Text>
      </Box>
    </Flex>
  );
};
