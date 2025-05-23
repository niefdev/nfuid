from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="nfuid",
    version="1.2.4",
    author="niefdev",
    author_email="niefdev@gmail.com",
    description="A compact library for generating and decoding unique, URL-safe IDs using timestamps and random entropy",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/niefdev/nfuid",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.6",
    keywords="uid, id, generator, timestamp, entropy, unique, url-safe",
    project_urls={
        "Bug Reports": "https://github.com/niefdev/nfuid/issues",
        "Source": "https://github.com/niefdev/nfuid",
    },
)
