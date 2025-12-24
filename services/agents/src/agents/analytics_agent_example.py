"""
Example usage of AnalyticsAgent.

This demonstrates how to configure and use the AnalyticsAgent with different
database configurations.
"""

import asyncio
from analytics_agent import AnalyticsAgent
from database import DatabaseType


async def example_postgresql():
    """Example: Using AnalyticsAgent with PostgreSQL."""
    
    # Configure PostgreSQL database
    db_config = {
        "db_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "mydb",
        "user": "myuser",
        "password": "mypassword",
        "schema": "public",  # Optional
        "pool_size": 10,
    }
    
    # Create agent with database configuration
    agent = AnalyticsAgent(
        db_config=db_config,
        session_id="example_session",
        enable_memory=True,
    )
    
    # Execute a natural language query
    result = await agent.execute({
        "query": "What are the top 10 customers by revenue in the last quarter?"
    })
    
    if result.success:
        print("Query successful!")
        print(f"SQL: {result.data.get('sql')}")
        print(f"Results: {result.data.get('results')}")
        print(f"Response: {result.data.get('response')}")
    else:
        print(f"Error: {result.error}")


async def example_configure_later():
    """Example: Configure database connection after agent creation."""
    
    # Create agent without database config
    agent = AnalyticsAgent(
        session_id="example_session_2",
        enable_memory=True,
    )
    
    # Configure database later
    db_config = {
        "db_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "mydb",
        "user": "myuser",
        "password": "mypassword",
    }
    
    configured = agent.configure_database(db_config)
    if configured:
        print("Database configured successfully!")
        
        # Now execute queries
        result = await agent.execute({
            "query": "Show me all tables in the database"
        })
        print(result.data)
    else:
        print("Failed to configure database")


async def example_multiple_queries():
    """Example: Multiple queries in a session."""
    
    db_config = {
        "db_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "mydb",
        "user": "myuser",
        "password": "mypassword",
    }
    
    agent = AnalyticsAgent(
        db_config=db_config,
        session_id="multi_query_session",
        enable_memory=True,
    )
    
    queries = [
        "What tables are available in the database?",
        "Show me the schema of the customers table",
        "How many customers do we have?",
        "What is the average order value?",
    ]
    
    for query in queries:
        print(f"\nQuery: {query}")
        result = await agent.execute({"query": query})
        if result.success:
            print(f"Answer: {result.data.get('response')[:200]}...")
        else:
            print(f"Error: {result.error}")


if __name__ == "__main__":
    # Run examples
    # asyncio.run(example_postgresql())
    # asyncio.run(example_configure_later())
    # asyncio.run(example_multiple_queries())
    print("See examples above. Uncomment to run.")

