import React from 'react';
import { NavLink } from 'react-router-dom';
// Chakra imports
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Icon,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Text,
} from '@chakra-ui/react';
// Custom components
import { FullPageLayout } from '~/layouts/FullPage';
// Assets
import { Form, useActionData } from '@remix-run/react';
import { MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import { FooterFullPage } from '~/components/footer/FooterFullPage';
import type { action } from '~/routes/signin';

const getErrorMessage = (message: string) => {
  if (message === 'BAD_CREDENTIALS' || message === 'NOT_AUTHORIZED') {
    return 'Invalid email and/or password';
  }
  return 'Oh no, something went wrong';
};

export const SignIn = () => {
  const actionData = useActionData<typeof action>();

  const textColor = 'white';
  const textColorSecondary = 'gray.400';
  const textColorDetails = 'secondaryGray.600';
  const textColorBrand = 'brand.500';
  const brandStars = 'brand.500';
  const [show, setShow] = React.useState(false);
  const handleClick = () => setShow(!show);

  const isEmailError = Boolean(actionData && 'email' in actionData.error);
  const errorMessage = actionData && 'message' in actionData.error ? getErrorMessage(actionData.error.message) : null;

  return (
    <FullPageLayout>
      <Flex
        maxW={{ base: '100%', md: 'max-content' }}
        w="100%"
        mx={{ base: 'auto', lg: '0px' }}
        me="auto"
        h="100%"
        alignItems="start"
        justifyContent="center"
        mb={{ base: '30px', md: '60px' }}
        px={{ base: '25px', md: '0px' }}
        mt={{ base: '10px', md: '7vh' }}
        flexDirection="column"
      >
        <Flex w="100%" justify="center" mb="25px">
          <Image src="/img/logo.png" width="300px" />
        </Flex>
        <Box me="auto">
          <Heading color={textColor} fontSize="36px" mb="10px">
            Sign In
          </Heading>
          <Text mb="36px" ms="4px" color={textColorSecondary} fontWeight="400" fontSize="md">
            Enter your email and password to sign in!
          </Text>
        </Box>
        <Flex
          as={Form}
          method="post"
          noValidate
          zIndex="2"
          direction="column"
          w={{ base: '100%', md: '420px' }}
          maxW="100%"
          borderRadius="15px"
          mx={{ base: 'auto', lg: 'unset' }}
          me="auto"
          mb={{ base: '20px', md: 'auto' }}
        >
          {errorMessage ? (
            <Text mb="20px" color="red.500" textAlign="center">
              {errorMessage}
            </Text>
          ) : null}
          <FormControl mb="24px" isInvalid={isEmailError}>
            <FormLabel display="flex" ms="4px" fontSize="sm" fontWeight="500" color={textColor} mb="8px">
              Email<Text color={brandStars}>*</Text>
            </FormLabel>
            <Input
              name="email"
              isRequired
              variant="auth"
              fontSize="sm"
              ms={{ base: '0px', md: '0px' }}
              type="email"
              placeholder="Email"
              fontWeight="500"
              size="lg"
            />
            {isEmailError ? <FormErrorMessage>A valid email is required.</FormErrorMessage> : null}
          </FormControl>
          <FormControl>
            <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor} display="flex">
              Password<Text color={brandStars}>*</Text>
            </FormLabel>
            <InputGroup size="md">
              <Input
                name="password"
                isRequired={true}
                fontSize="sm"
                placeholder="Password"
                mb="24px"
                size="lg"
                type={show ? 'text' : 'password'}
                variant="auth"
              />
              <InputRightElement display="flex" alignItems="center" mt="4px">
                <Icon
                  color={textColorSecondary}
                  _hover={{ cursor: 'pointer' }}
                  as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                  onClick={handleClick}
                />
              </InputRightElement>
            </InputGroup>
            <Flex justifyContent="space-between" align="center" mb="24px">
              <FormControl display="flex" alignItems="center">
                <Checkbox id="remember-login" colorScheme="brandScheme" me="10px" />
                <FormLabel htmlFor="remember-login" mb="0" fontWeight="normal" color={textColor} fontSize="sm">
                  Keep me logged in
                </FormLabel>
              </FormControl>
              <NavLink to="/auth/forgot-password">
                <Text color={textColorBrand} fontSize="sm" w="124px" fontWeight="500">
                  Forgot password?
                </Text>
              </NavLink>
            </Flex>
            <Button type="submit" fontSize="sm" variant="brand" fontWeight="500" w="100%" h="50" mb="24px">
              Sign In
            </Button>
          </FormControl>
          <Flex flexDirection="column" justifyContent="center" alignItems="start" maxW="100%" mt="0px">
            <Text color={textColorDetails} fontWeight="400" fontSize="14px">
              Not registered yet?
              <NavLink to="/auth/sign-up">
                <Text color={textColorBrand} as="span" ms="5px" fontWeight="500">
                  Create an Account
                </Text>
              </NavLink>
            </Text>
          </Flex>
        </Flex>
      </Flex>
      <Box
        display={{ base: 'none', md: 'block' }}
        h="100%"
        minH="100vh"
        w={{ lg: '50vw', '2xl': '44vw' }}
        position="absolute"
        right="0px"
      >
        <Flex
          bg="url(https://source.unsplash.com/random?brewery)"
          justify="center"
          align="end"
          w="100%"
          h="100%"
          bgSize="cover"
          bgPosition="50%"
          position="absolute"
          borderBottomLeftRadius={{ lg: '120px', xl: '200px' }}
          overflow="hidden"
        >
          <Box
            position="absolute"
            w="100%"
            h="150px"
            bottom={0}
            bg="linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);"
          />
        </Flex>
      </Box>
      <FooterFullPage />
    </FullPageLayout>
  );
};
